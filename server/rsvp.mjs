const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestCounts = new Map();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += bytes.byteLength;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(bytes);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function isRateLimited(request) {
  const ip = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const current = requestCounts.get(ip);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

export function createRsvpHandler({ supabaseUrl, serviceRoleKey, allowedIds }) {
  return async function handleRsvp(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const origin = request.headers.origin;
    const host = request.headers.host;
    try {
      if (!origin || !host || new URL(origin).host !== host) {
        sendJson(response, 403, { error: "Request origin is not allowed." });
        return;
      }
    } catch {
      sendJson(response, 403, { error: "Request origin is not allowed." });
      return;
    }

    if (isRateLimited(request)) {
      sendJson(response, 429, { error: "Too many requests. Please try again later." });
      return;
    }

    let payload;
    try {
      payload = await readJsonBody(request);
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
      sendJson(response, status, { error: error.message });
      return;
    }

    const { id, data } = payload ?? {};
    const databaseId = typeof id === "string" ? allowedIds[id] : undefined;
    if (
      typeof id !== "string" ||
      !Number.isSafeInteger(databaseId) ||
      databaseId < 1 ||
      typeof data?.attending !== "boolean" ||
      typeof data?.message !== "string" ||
      data.message.length > 500
    ) {
      sendJson(response, 400, { error: "Invalid invitation response." });
      return;
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
      sendJson(response, 503, { error: "Supabase is not configured on the server." });
      return;
    }

    const endpoint = new URL(supabaseUrl);
    endpoint.searchParams.set("id", `eq.${databaseId}`);

    try {
      const result = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!result.ok) {
        let upstreamError = {};
        try {
          upstreamError = await result.json();
        } catch {
          upstreamError = {};
        }

        if (upstreamError.code === "22P02") {
          sendJson(response, 400, {
            error: "Supabase graduation.id is numeric, but this invitation uses a text ID. Configure a numeric database ID for this guest or change the column to text.",
          });
          return;
        }

        console.error("Supabase RSVP update was rejected.", {
          status: result.status,
          code: upstreamError.code,
          message: upstreamError.message,
        });
        const status = result.status >= 500 ? 502 : 400;
        sendJson(response, status, {
          error: `Supabase rejected the RSVP update${upstreamError.code ? ` (${upstreamError.code})` : ""}. Check the table schema and permissions.`,
        });
        return;
      }

      const rows = await result.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        sendJson(response, 404, { error: "Invitation ID was not found in Supabase." });
        return;
      }

      sendJson(response, 200, { ok: true });
    } catch (error) {
      console.error("Supabase RSVP request failed.", error);
      sendJson(response, 502, { error: "Could not connect to Supabase." });
    }
  };
}
