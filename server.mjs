import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { createRsvpHandler } from "./server/rsvp.mjs";
import invitations from "./src/data/invitations.json" with { type: "json" };

const distDirectory = resolve("dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

const handleRsvp = createRsvpHandler({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  allowedIds: Object.fromEntries(
    invitations.map((invitation) => [
      invitation.id,
      { supabaseId: invitation.supabaseId, guestName: invitation.guestName },
    ]),
  ),
});

const server = createServer((request, response) => {
  if (new URL(request.url ?? "/", "http://localhost").pathname === "/api/rsvp") {
    void handleRsvp(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Invalid URL");
    return;
  }

  let filePath = resolve(distDirectory, `.${pathname}`);
  if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = resolve(distDirectory, "index.html");
  }
  if (!existsSync(filePath)) {
    response.writeHead(503);
    response.end("Build the app with npm run build before starting the production server.");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const file = createReadStream(filePath);
  file.on("error", (error) => {
    console.error("Could not read a built asset.", error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  file.pipe(response);
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, "0.0.0.0", () => {
  console.log(`Graduation invitation server listening on port ${port}.`);
});
