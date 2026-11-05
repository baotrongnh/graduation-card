import { loadEnv, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRsvpHandler } from "./server/rsvp.mjs";
import invitations from "./src/data/invitations.json";

function rsvpPlugin(env: Record<string, string>) {
  const handleRsvp = createRsvpHandler({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    allowedIds: Object.fromEntries(
      invitations.map((invitation) => [invitation.id, invitation.supabaseId]),
    ),
  });
  const middleware = (request, response, next) => {
    if (request.url?.split("?")[0] !== "/api/rsvp") {
      next();
      return;
    }
    void handleRsvp(request, response);
  };

  return {
    name: "graduation-rsvp-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rsvpPlugin(loadEnv(mode, process.cwd(), ""))],
}));
