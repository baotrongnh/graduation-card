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

Each invitation has a public slug (`id`) for its URL and a numeric
`supabaseId` for the `bigint` ID in the existing `public.graduation` table. The
RSVP API maps the slug to the numeric database ID and writes this JSON to the
existing `data` column:

```json
{
  "attending": true,
  "message": "A message from the guest"
}
```

The development server handles the RSVP API. For production, build the app and
run the included Node server, which serves the static site and the same API:

```sh
npm run build
npm start
```

Deploy to a Node.js host, provide `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as private server environment variables, and use
`PORT` if the host specifies a port. Never add the service-role key to a
`VITE_` variable or expose it in client-side code.

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
Supabase row ID. Current mappings are `bui-anh-kha` → 1 and `ngoc-anh` → 2.
Update the Google Maps search URL and event details in `src/App.tsx` when the
venue information is finalized.
"# graduation-card" 
