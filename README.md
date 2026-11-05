# Graduation invitation

Mobile-first React and TypeScript invitation site for Bảo Trọng's graduation.

## Run locally

The project reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the root
`.env` file. Keep this file private; the service-role key is used only by the
Node.js API and is never included in the browser bundle.

```sh
npm install
npm run dev
```

Each SVG in `public/invitations/` has a matching entry in
`src/data/invitations.json`. Its `id` is the filename without `.svg`, and
`supabaseId` is the numeric ID for the `bigint` ID in the existing
`public.graduation` table. Fill in each guest's name and personal message.
The RSVP API maps the slug to the numeric database ID and writes this JSON to
the existing `data` column:

```json
{
  "attending": true,
  "message": "A message from the guest",
  "guestName": "Guest name"
}
```

`guestName` is added by the server from the invitation list, so it remains
associated with the correct Supabase row and is not accepted from the browser.
The current 12 invitations have matching Supabase rows with IDs 1–12. For a
new guest, create a row in Supabase first and set `supabaseId` to its numeric ID.
Choosing an attendance option saves the RSVP immediately. Message drafts are
saved locally while typing and can be sent with the dedicated message button.

The Vite development server handles the RSVP API. For a Node.js host, build
the app and run the included server, which serves the static site and the same
API:

```sh
npm run build
npm start
```

For Vercel, the included `vercel.json` builds the Vite app, serves invitation
slugs such as `/bui-anh-kha` through the SPA, and deploys `api/rsvp.mjs` as a
serverless function. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the
Vercel project's Environment Variables for each deployment environment. Never
add the service-role key to a `VITE_` variable or expose it in client-side code.
The same environment variables must be configured privately on a Node.js host.

The public invitation ID identifies the row but does not authenticate a guest.
The API accepts only IDs present in `src/data/invitations.json`, checks the
same-origin request, validates RSVP data, limits message length, and applies a
basic per-IP rate limit. Do not store sensitive information in invitation
responses.

## Add a guest invitation

1. Add that guest's SVG to `public/invitations/`.
2. Add an entry to `src/data/invitations.json`:

```json
{
  "id": "guest-id",
  "supabaseId": 3,
  "guestName": "Guest name",
  "svg": "/invitations/guest-id.svg",
  "message": "A personal message for this guest."
}
```

The guest's link is `/guest-id`. Set `supabaseId` to that guest's numeric
Supabase row ID; continue the numeric sequence for new guests.
Update the Google Maps search URL and event details in `src/App.tsx` when the
venue information is finalized.
"# graduation-card" 
