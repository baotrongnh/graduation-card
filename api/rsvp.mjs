import { createRsvpHandler } from "../server/rsvp.mjs";
import invitations from "../src/data/invitations.json" with { type: "json" };

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

export default async function handler(request, response) {
  await handleRsvp(request, response);
}
