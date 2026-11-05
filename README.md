# Relay

## Database setup

Copy `.env.example` to `.env` and set `DATABASE_URL` to the PostgreSQL connection
string provided by Neon. Keep `.env` private; only the placeholder `.env.example`
belongs in source control.

Set `ENDPOINT_SECRET_ENCRYPTION_KEY` to a newly generated base64-encoded 32-byte
key. For example, run
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
and put its output in `.env`. Keep this key private and backed up; losing it
makes stored endpoint secrets unrecoverable.

Generate Prisma Client and create/apply the initial migration with:

```sh
npm run prisma:generate
npm run prisma:migrate -- --name init
```

`src/config/prisma.ts` exports the reusable Neon-backed Prisma Client instance.
The existing Express server does not connect to the database automatically.
Endpoint secrets must be encrypted with `src/utils/endpoint-secret.ts` before
they are stored. The security migration stops if endpoint rows exist, so legacy
secrets can be encrypted deliberately rather than silently retained in plaintext.

## API v1

- `POST /api/v1/projects` creates a project and returns its initial `apiKey`
  once. Save it securely; only its SHA-256 hash is stored.
- `POST /api/v1/api-keys` creates another project-scoped key.
- `DELETE /api/v1/api-keys/:id` revokes a key.
- `POST`, `GET`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` on
  `/api/v1/endpoints` manage endpoints. These routes require
  `Authorization: Bearer <api_key>`.

Endpoint URLs must be HTTPS and resolve exclusively to public IP addresses.
The DNS-pinning helper in `src/services/webhook-url.ts` is provided for future
delivery code: revalidate immediately before connecting, use
`createPinnedHttpsAgent` for that validated target, and do not follow redirects.
Endpoint management itself does not send outbound requests. Signing secrets are
generated and encrypted at rest. `POST /api/v1/endpoints` returns the plaintext
`signingSecret` once, at creation time; save it securely. It is never included
in endpoint GET, LIST, PATCH, or DELETE responses and cannot be retrieved later.

Run the API test suite with `npm test`.
