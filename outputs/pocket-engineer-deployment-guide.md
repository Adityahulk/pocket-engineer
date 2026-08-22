# Pocket Engineer — Deployment and Release Guide

Updated: August 22, 2026
Target: single-user/private-alpha release

## Deployment decision

Use this stack for the first hosted release:

| Layer | Recommended service | Why |
|---|---|---|
| Source and CI | GitHub + GitHub Actions | The repository already contains CI and the product integrates with GitHub Apps. |
| API and worker | Railway, one service/replica | The current worker runs in the FastAPI process; one replica avoids duplicate task claims. Railway builds the included Dockerfile and supports health checks and GitHub auto-deploys. |
| Database | Railway PostgreSQL | Simple private-network connection through `DATABASE_URL`; no SQLite persistence risk. |
| User authentication | Supabase Auth free tier | Established auth framework; the API verifies asymmetric JWTs from Supabase JWKS and restricts access to an email allowlist. |
| iOS/Android builds | Expo EAS Build | Required because native WebRTC is not supported by Expo Go; the included EAS profiles cover development, preview, and production. |
| Voice | OpenAI Realtime over WebRTC | The existing backend mints short-lived client secrets; the standard API key remains on Railway. |
| Coding agent | Aider in the API image | Already integrated and installed in the deployment image. Use only on repositories you control until managed sandbox isolation is added. |

Railway is the best fit for this private alpha because it has Dockerfile deployments, managed PostgreSQL, health checks, and inexpensive usage-based hosting in one interface. Railway currently advertises a limited free trial/free resource allowance and a $5 Hobby baseline; confirm current usage after one week. Render's free Postgres expires after 30 days and free web services spin down, which makes it a poor match for calls and background Missions.

This is not the final production topology. A multi-user release must split the API and worker and send repository execution to managed microVM sandboxes.

## 1. Create authentication

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **Authentication → Users**, create the one private-alpha user and set a strong password.
3. Disable open user sign-ups for the private alpha.
4. In project settings, copy:
   - Project URL: `https://YOUR_PROJECT.supabase.co`
   - Publishable key: `sb_publishable_...`
5. Use asymmetric signing keys. The API reads public signing keys from:
   `https://YOUR_PROJECT.supabase.co/auth/v1/.well-known/jwks.json`.

The publishable key belongs in the mobile bundle. A Supabase secret/service-role key never does.

## 2. Deploy the API and PostgreSQL on Railway

1. Sign in at [Railway](https://railway.com/) and choose **New Project → Deploy from GitHub repo**.
2. Select the Pocket Engineer repository.
3. Railway will detect the root `railway.toml`, build `apps/api/Dockerfile`, and health-check `/health/ready`.
4. Add a PostgreSQL service with **New → Database → PostgreSQL**.
5. On the API service, create these variables:

```text
POCKET_ENVIRONMENT=alpha
POCKET_DATABASE_URL=${{Postgres.DATABASE_URL}}
POCKET_PUBLIC_BASE_URL=https://YOUR_API_DOMAIN
POCKET_CORS_ORIGINS=https://YOUR_WEB_APP_DOMAIN
POCKET_DEMO_ENABLED=false
POCKET_WORKER_ENABLED=true

POCKET_AUTH_MODE=supabase
POCKET_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
POCKET_AUTH_ALLOWED_EMAILS=you@example.com

POCKET_AGENT_PROVIDER=aider
POCKET_AIDER_MODEL=openai/gpt-5
OPENAI_API_KEY=YOUR_OPENAI_API_KEY

POCKET_OPENAI_API_KEY=YOUR_OPENAI_API_KEY
POCKET_REALTIME_MODEL=gpt-realtime-2.1
POCKET_REALTIME_VOICE=marin
```

`OPENAI_API_KEY` is consumed by Aider; `POCKET_OPENAI_API_KEY` is consumed by the voice session broker. Railway should store both as service secrets. Start with a project-scoped OpenAI key and a conservative usage limit.

6. Generate a Railway public domain for the API.
7. Replace `POCKET_PUBLIC_BASE_URL` with that HTTPS domain and redeploy.
8. Confirm:

```bash
curl https://YOUR_API_DOMAIN/health
curl https://YOUR_API_DOMAIN/health/ready
curl https://YOUR_API_DOMAIN/v1/projects
```

The first two must return HTTP 200. The third must return HTTP 401 without a Supabase access token.

Keep the API at exactly one replica. The current worker claims queued Missions in-process and is not yet safe for horizontal replicas.

## 3. Create the GitHub App used by Pocket Engineer

Create a GitHub App in a dedicated test organization first.

Repository permissions:

- Metadata: read
- Contents: read and write
- Pull requests: read and write

Do not grant administration, Actions secrets, deployments, or organization-wide write permissions.

Generate its private key and add these Railway secrets:

```text
POCKET_GITHUB_APP_SLUG=your-app-slug
POCKET_GITHUB_APP_ID=123456
POCKET_GITHUB_PRIVATE_KEY=<full PEM private key>
```

Set the setup/callback route for the development app to `pocket-engineer://github`. Before App Store release, configure a verified universal/app link on a domain you control. Install the GitHub App only on the test repositories the alpha will manage.

## 4. Build and distribute the mobile app with EAS

From `apps/mobile`:

```bash
npm install --global eas-cli
eas login
eas init
```

If `eas init` adds an Expo project ID to `app.json`, commit and push that change.

Create public build-time settings. These values are not secrets and are embedded in the client:

```bash
eas env:set --name EXPO_PUBLIC_API_URL \
  --value https://YOUR_API_DOMAIN \
  --environment preview --visibility plaintext

eas env:set --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://YOUR_PROJECT.supabase.co \
  --environment preview --visibility plaintext

eas env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --value sb_publishable_YOUR_KEY \
  --environment preview --visibility plaintext
```

Repeat those three commands with `--environment production` before an App Store build.

Build an installable private preview:

```bash
eas build --platform all --profile preview
```

Install the build on the test devices from the EAS links. Validate voice on a physical iPhone and Android device; Expo Go cannot load the native WebRTC module.

For store release:

```bash
eas build --platform all --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Apple Developer and Google Play Console accounts are required for public store distribution.

## 5. Release verification

Run locally before every release:

```bash
make test
docker build -f apps/api/Dockerfile -t pocket-engineer-api .
```

Then test this hosted sequence on both platforms:

1. A non-allowlisted or signed-out client cannot read Projects.
2. The allowlisted user signs in.
3. The user installs the GitHub App and selects a test repository.
4. The user starts a small FIX Mission.
5. The agent installs dependencies, changes code, and runs repository-native checks.
6. The exact diff and verification results appear on the phone.
7. PR creation fails before approval.
8. After explicit approval, a `pocket/*` branch and GitHub PR are created.
9. A voice call can be interrupted, drafts a Mission, and never starts it without the visible **Start Mission** action.
10. Restart the Railway service during a queued Mission and verify that task/event state remains in PostgreSQL.

## 6. What can ship now and what cannot

Safe scope for this deployment:

- One allowlisted operator.
- Dedicated test organization and repositories owned by that operator.
- FIX and small MODIFY Missions.
- Human-reviewed pull requests only.
- Voice briefings and Mission drafting.
- No merge, deployment, rollback, or production credentials.

Do not onboard external customers or untrusted repositories yet. The current local process runner is not a hostile-code isolation boundary.

Before multi-user production, implement these release gates:

1. Organization/tenant models and tenant-scoped authorization on every query.
2. Managed microVM sandboxes with default-deny egress and short-lived scoped credentials.
3. A separate durable workflow service/queue with idempotent task claiming and PR publication.
4. Encrypted secret brokering, redaction, artifact storage, retention, export, and deletion.
5. Rate limits, quotas, budget controls, audit logs, notifications, and operational alerting.
6. External penetration testing, incident response, backup/restore drills, and documented SLOs.
7. Billing and customer support controls.

## Official references

- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railway pricing](https://railway.com/pricing)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
