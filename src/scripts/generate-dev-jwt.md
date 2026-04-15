# Generating a dev JWT for the Corporate API

The dashboard's LIVE mode (`VITE_USE_MOCKS=false`) needs a Bearer token
to hit authenticated endpoints on the Corporate API at `localhost:3000`.
The Corporate API uses HS256 JWTs signed with the `JWT_SECRET` env var
from its own `.env` file.

> **Wave 1 note:** The only endpoint wired in Wave 1 is `GET /health`,
> which is **public** (no auth required). You do NOT need a JWT to
> verify the LIVE mode plumbing — you only need a JWT for Wave 2 when
> real authenticated endpoints come online.

## JWT payload contract

Per `~/Downloads/haseeb-corporate-api/Hasseb_Standalone_Api/src/shared/types/express.d.ts`
the API expects `AuthPayload`:

```ts
interface AuthPayload {
  userId: string;
  tenantSlug: string;
  role: 'OWNER' | 'ACCOUNTANT' | 'VIEWER';
}
```

Plus a `jti` (JWT ID) claim is **required** — the auth middleware at
`src/shared/middleware/auth.middleware.ts` rejects tokens without one
and additionally checks that a matching `Session` row exists in the
tenant database and has not expired. That means **a freshly minted
JWT alone is not enough** for authenticated routes — you also need a
corresponding session row. For Wave 2, either:

1. Sign in through the real `/api/auth/login` flow once and copy the
   resulting access token out of the browser's storage, OR
2. Insert a session row directly into the tenant DB whose `id` matches
   your `jti`, whose `userId` matches a real user in that tenant, and
   whose `expiresAt` is in the future.

Option (1) is simpler and recommended once login comes online.

## Steps (option: minting a raw token for inspection / public endpoints)

1. Find `JWT_SECRET` in the Corporate API's `.env`:
   ```sh
   cat ~/Downloads/haseeb-corporate-api/Hasseb_Standalone_Api/.env | grep JWT_SECRET
   ```

2. Generate a token with Node:
   ```sh
   node -e "
   const jwt = require('jsonwebtoken');
   const { randomUUID } = require('crypto');
   const secret = 'PASTE_JWT_SECRET_HERE';
   const token = jwt.sign(
     {
       userId: 'dev-user-id',
       tenantSlug: 'dev-tenant',
       role: 'OWNER',
       jti: randomUUID()
     },
     secret,
     { algorithm: 'HS256', expiresIn: '30d' }
   );
   console.log(token);
   "
   ```

3. Copy the token into `.env.local` at the dashboard repo root:
   ```
   VITE_USE_MOCKS=false
   VITE_API_BASE_URL=http://localhost:3000
   VITE_DEV_JWT=eyJhbGc...
   ```

4. Restart `npm run dev` to pick up the new env var.

## Security

- **Never commit `.env.local`** — it is gitignored at the repo root.
- **Never reuse this token in staging or prod.** It is strictly for
  local dev against a local Corporate API instance.
- If you suspect the token leaked, rotate `JWT_SECRET` on the API side
  and re-mint.

## Reference

- Auth middleware (source of truth for the token contract):
  `~/Downloads/haseeb-corporate-api/Hasseb_Standalone_Api/src/shared/middleware/auth.middleware.ts`
- AuthPayload type:
  `~/Downloads/haseeb-corporate-api/Hasseb_Standalone_Api/src/shared/types/express.d.ts`
- Public health endpoint (no auth):
  `~/Downloads/haseeb-corporate-api/Hasseb_Standalone_Api/src/app.ts` → `GET /health`
