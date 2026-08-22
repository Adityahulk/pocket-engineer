# Pocket Engineer

Pocket Engineer is the mobile Mission Control for autonomous software engineering. It presents the user's software estate, production health, incidents, AI engineers, Missions, and decisions above a verified execution layer. This repository implements the first complete product loop:

```text
observe software health → brief an engineer by voice or text → confirm Mission
→ investigate → change code → run tests
→ review exact patch → approve → create pull request
```

The default configuration is deliberately local and free: an Expo mobile app, FastAPI, SQLite, a deterministic agent for the bundled fixture, and real Git/test execution. PostgreSQL, GitHub App installation tokens, Aider, and Docker are supported integration boundaries for non-demo environments.

## What is implemented

- Expo Router mobile app for iOS, Android, and web.
- React Query data synchronization and background task polling.
- Command Center, software health/incidents, AI Engineer status, Mission composer, progress timeline, result, verification, diff, approval, and PR screens.
- A phone-call-style engineer experience with native/web WebRTC, speech-to-speech audio, live transcript, listening/thinking/speaking states, barge-in, mute, end-call, and typed fallback.
- A safe voice-to-Mission handoff: the engineer can draft work, but the user must tap **Start Mission**.
- FastAPI control plane with OpenAPI documentation.
- SQLAlchemy persistence on SQLite locally or PostgreSQL in containers.
- Durable task/event records and restart-safe queued work.
- Repository snapshot pinning, isolated temporary workspaces, Git diff export, and cleanup.
- Repository-native test discovery for Python and TypeScript/JavaScript.
- Mandatory approval before any remote Git write.
- GitHub App JWT/installation tokens, repository selection endpoint, authenticated clone, branch push, and pull-request creation.
- Aider adapter for real model-driven repository changes.
- A no-key deterministic agent and intentionally broken checkout fixture for a fully reproducible demo.
- API tests covering the complete task and approval workflow.
- Docker Compose PostgreSQL/API environment and a reusable Node/Python sandbox image.
- Optional Supabase authentication with server-side JWT/JWKS verification and a private-alpha email allowlist.
- Repository dependency installation before verification, including isolated Python environments and clean npm installs.
- Railway config-as-code, EAS Build profiles, deployment readiness checks, and GitHub Actions CI.

## Quick start

Requirements: Python 3.12+, `uv`, Node 20.19.4+ (Node 24 is pinned in the mobile app), npm, Git, and optionally Docker.

Terminal 1:

```bash
cd apps/api
uv sync --extra dev
uv run uvicorn pocket_engineer.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2:

```bash
cd apps/mobile
nvm use
npm install
npm start
```

Open the web target or Expo Go, select **Checkout API Demo**, and start the prefilled FIX task. The task changes a real copied repository, executes pytest, shows the exact Git patch, requires approval, and completes a local demo PR.

## Engineer calls

The voice layer follows the official Realtime WebRTC pattern: the API uses its standard provider credential to mint a short-lived client secret, and the mobile/web client connects directly over WebRTC. The standard key never enters the application bundle.

```bash
export POCKET_OPENAI_API_KEY=your_server_side_key
export POCKET_REALTIME_MODEL=gpt-realtime-2.1
export POCKET_REALTIME_VOICE=marin
```

Restart the API and tap **Call Engineer**. The engineer receives only portfolio, software-health, and Mission summaries—not repository contents or secrets. It can discuss status and prepare a Mission draft; starting work and every later Git/deployment action remain visible confirmations.

Web voice works in the Expo web target. Native voice uses `react-native-webrtc`, so it requires an Expo development/native build rather than Expo Go:

```bash
cd apps/mobile
npm run native:ios
# or
npm run native:android
```

Without a configured voice provider, the call screen stays usable as a typed engineering brief and Mission-review experience.

## Private-alpha authentication

Local development leaves authentication disabled. For any public deployment, create a Supabase project, create the allowed user in **Authentication → Users**, and configure both sides:

```bash
# API server only
POCKET_AUTH_MODE=supabase
POCKET_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
POCKET_AUTH_ALLOWED_EMAILS=you@example.com

# Expo build-time public configuration
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is intentionally client-visible; never put a Supabase secret/service-role key or an OpenAI/GitHub credential in an `EXPO_PUBLIC_*` variable. The API validates the signed access token and rejects authenticated accounts outside the allowlist. This is a single-user private-alpha boundary, not multi-tenant authorization.

For a physical device, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` to the computer's LAN address, and start Expo with that environment value.

## One-command checks

```bash
make test
```

API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs) while the server is running.

## PostgreSQL/API containers

```bash
docker compose up --build
```

The Expo application still runs on the host and talks to port 8000.

## Deploy the private alpha

The repository includes `railway.toml`, a Railway-compatible API Dockerfile, `/health/ready`, `apps/mobile/eas.json`, and GitHub Actions CI. The exact Railway, Supabase, GitHub App, OpenAI, and EAS setup is in `outputs/pocket-engineer-deployment-guide.md`.

## Connect a GitHub App

1. Create a GitHub App owned by your test account or organization.
2. Give it repository metadata read, contents read/write, and pull requests read/write permissions.
3. Set its setup URL/deep link to `pocket-engineer://github` for a development build. Use a verified universal/app link for production.
4. Generate a private key and set `POCKET_GITHUB_APP_SLUG`, `POCKET_GITHUB_APP_ID`, and `POCKET_GITHUB_PRIVATE_KEY`.
5. Restart the API. **Connect GitHub** opens the installation page; GitHub returns `installation_id` to the repository picker.

Use a dedicated test organization first. The service pins the default-branch SHA, verifies in a temporary workspace, checks that the base has not moved, applies the reviewed patch, pushes a `pocket/*` branch, and opens a PR. It never merges or deploys.

`POCKET_GITHUB_TOKEN` is available only as a local development fallback. Do not use a broad personal token in production.

## Use a real coding agent

The open-source [Aider](https://aider.chat/) adapter avoids rebuilding repository editing and model-provider support:

```bash
cd apps/api
uv sync --extra agent --extra dev
export POCKET_AGENT_PROVIDER=aider
export POCKET_AIDER_MODEL=your-provider/model
# Set the provider credential expected by Aider.
uv run uvicorn pocket_engineer.main:app --reload
```

The control plane still owns repository access, verification, the reviewed patch, approval, Git publishing, and audit events. A model cannot grant itself those permissions.

## Security boundary

The default `local` runner is a development mode, not a production isolation boundary. Before accepting untrusted repositories, replace it with the `SandboxProvider`/managed microVM implementation described in the implementation plan, default-deny network egress, add organization authentication/RBAC, move workflows to a separately scaled durable worker, and complete the documented security gates. The included sandbox image is a reproducible toolchain baseline; a plain Docker daemon alone should not be treated as a hostile-code security boundary.

## Repository map

```text
apps/mobile                 Expo application
apps/api                    FastAPI control plane and task runner
fixtures/demo-checkout      Reproducible broken repository
images/sandbox              Free Node/Python toolchain image
outputs                     Product implementation plan
```

## Intentional launch gates

This build is an end-to-end private-alpha implementation, not a claim of production GA. Authentication is available for a single-user deployment. Production admission remains blocked until tenant isolation, managed microVM execution, durable distributed workflows, secret brokering/redaction, rate limits, external security testing, notifications, billing, and operational SLOs meet the implementation plan's release gates.
