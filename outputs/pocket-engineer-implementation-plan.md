# Pocket Engineer — End-to-End Implementation Plan

Status: proposed implementation baseline
Planning horizon: MVP through general availability, followed by Phases 2–4
Primary milestone: a mobile user connects a GitHub repository, asks the agent to fix a real bug, reviews a verified result, and creates a pull request

## 1. Executive decision

Build Pocket Engineer as a mobile control plane over a secure, asynchronous software-engineering service. The first release should not attempt the entire long-term vision. It should prove one high-trust workflow:

1. Connect a private or public GitHub repository.
2. Describe a bug or small change in natural language.
3. Let the system inspect the repository and form an evidence-backed plan.
4. Execute the work in an isolated cloud sandbox.
5. Run repository-appropriate checks and tests.
6. Present a mobile-readable explanation, verification report, and diff.
7. Create a branch and pull request only after user approval.

The MVP supports FIX and small MODIFY tasks. BUILD, production deployment, screenshot debugging, voice, browser automation, multi-agent teams, and continuous maintenance remain outside the MVP. This sequencing minimizes security exposure and tests the product's core hypothesis: users will trust a mobile-controlled agent to change real repositories when the work is observable and verified.

## 2. Planning assumptions

This plan assumes:

- A team of 7–9 people: one engineering lead, two agent/backend engineers, one platform engineer, one mobile engineer, one full-stack engineer, one product designer, one QA/evaluation engineer, and fractional security/product support.
- A 30-week path from kickoff to a controlled general-availability release.
- GitHub is the only source-control integration in the MVP.
- The system creates branches and pull requests but cannot merge to the default branch or deploy to production in the MVP.
- One primary frontier model provider is used initially, behind a provider-independent gateway.
- A managed isolated-sandbox provider is used initially through an internal adapter; operating a custom microVM fleet is deferred.
- Web repositories and common backend repositories are supported first. Mobile-native, monorepo-at-extreme-scale, kernel, embedded, and GPU-heavy projects are unsupported initially.
- The default autonomy mode is Assisted: investigation is automatic; mutations, external network access, pull-request creation, and other sensitive actions have explicit policy gates.

If the initial team is only 2–3 engineers, expect the same scope to require roughly 9–15 months. Do not preserve the 30-week date by silently reducing security or verification work.

## 3. Scope and release boundaries

### MVP: included

- iOS and Android mobile app from one React Native codebase.
- Account creation and session management.
- GitHub App installation and repository selection.
- Organization and project model with basic roles.
- Repository cloning and incremental indexing.
- Chat-based FIX and limited MODIFY tasks.
- Read-only investigation before code mutation.
- Single-agent, state-machine-driven orchestration.
- Secure ephemeral task sandbox.
- Exact search, symbol search, semantic retrieval, Git history, and lightweight dependency analysis.
- File edits, dependency installation under policy, commands, builds, type checks, lint, and tests.
- Bounded diagnose-repair-verify loop.
- Live progress event stream and background notifications.
- Mobile summary, verification report, and semantic diff.
- User cancellation and approval.
- Branch, commit, and pull-request creation.
- Audit trail, metering, quotas, and internal operations console.

### Explicitly excluded from MVP

- Direct pushes to default branches.
- Pull-request merging.
- Production credentials or production deployment.
- GitLab and Bitbucket.
- Screenshot-to-fix, live browser agent, and device automation.
- Voice input beyond optional operating-system speech-to-text.
- Greenfield BUILD mode.
- Autonomous multi-agent teams.
- Long-running production monitoring and scheduled maintenance.
- Training a proprietary model.
- Self-hosted enterprise deployment.
- Visual code editor or desktop IDE features.

### MVP support matrix

Start with a published support matrix rather than promising arbitrary repositories:

| Dimension | Initial support |
|---|---|
| Source control | GitHub Cloud |
| Repository size | Target under 1 GB clone and under 250k source files; enforce hard limits |
| Languages | TypeScript/JavaScript and Python first |
| Package systems | npm/pnpm/yarn and pip/uv/Poetry, detected from lockfiles |
| Tasks | Bug fixes, tests, focused refactors, small feature changes |
| Git output | New branch, commits, and draft/non-draft PR |
| Deployment | None |
| Secrets | No production secrets in sandbox; scoped test secrets only through policy |

Add more languages only after fixtures, toolchain images, parsers, and evaluation coverage exist for them.

## 4. Product principles that become engineering constraints

1. **Outcome-first:** the primary input is the desired outcome, not files or commands.
2. **Evidence before mutation:** the agent must inspect and explain its working theory before making material changes.
3. **Verified, not merely generated:** every success claim links to checks actually run and their outputs.
4. **No silent authority expansion:** repository content, model output, and package scripts cannot grant permissions.
5. **Mobile-readable by default:** show decisions, risk, affected areas, and results before raw code.
6. **Asynchronous and resumable:** tasks may outlive an app session or worker process.
7. **Provider-independent boundaries:** models, sandbox vendors, storage, and notification providers sit behind adapters.
8. **Auditability:** every tool call, state transition, approval, Git action, and privileged access is attributable.

## 5. Recommended technical architecture

### 5.1 Technology choices

| Layer | Initial choice | Reason |
|---|---|---|
| Mobile | React Native, Expo, TypeScript | One mobile codebase, over-the-air non-native updates, strong TypeScript sharing |
| API | Python + FastAPI modular monolith | Strong AI/tooling ecosystem and fast delivery without premature microservices |
| Durable workflows | Temporal | Long-running tasks, retries, cancellation, timers, and crash recovery |
| Primary database | PostgreSQL | Tenant, task, audit, and billing system of record |
| Vector search | pgvector in PostgreSQL | Avoid a separate vector database until scale requires it |
| Cache/ephemeral state | Redis | Rate limits, short-lived cache, and presence; not the task system of record |
| Object storage | S3-compatible storage | Logs, artifacts, screenshots later, and large diff/test outputs |
| Repository integration | GitHub App | Installation-scoped permissions, webhooks, and short-lived tokens |
| Sandbox | Managed isolated microVM/container service behind `SandboxProvider` | Ship isolation quickly without owning a scheduler/fleet initially |
| Model access | Internal model gateway with one primary provider | Central policy, metering, fallbacks, and future routing |
| Infrastructure | AWS with Terraform | Managed data services, object storage, networking, and audit controls |
| API deployment | ECS/Fargate initially | Simpler operations than Kubernetes for the MVP control plane |
| Observability | OpenTelemetry + managed logs/metrics/traces + error reporting | Correlated visibility across API, workflow, model, and sandbox |
| Notifications | APNs and FCM through a notification service | Background completion and approval requests |

Use a modular monolith for the control plane. Keep module boundaries explicit and split services only when measured scaling, deployment isolation, or security boundaries require it.

### 5.2 Logical system

```text
Mobile app
  ├─ REST commands
  ├─ foreground event stream
  └─ APNs/FCM notifications
          │
          ▼
API / Agent Gateway
  ├─ Auth and organizations
  ├─ Projects and GitHub
  ├─ Tasks and approvals
  ├─ Diffs and artifacts
  └─ Usage and billing
          │
          ▼
Durable workflow orchestrator
  ├─ Repository/context service
  ├─ Model gateway
  ├─ Tool-policy broker
  ├─ Sandbox provider
  ├─ Verification engine
  └─ Git/PR service
          │
          ├─ PostgreSQL / pgvector
          ├─ Redis
          ├─ Object storage
          └─ GitHub API/webhooks
```

### 5.3 Repository layout

Use a monorepo for product code, but keep sandbox runtime images versioned independently:

```text
apps/
  mobile/                 React Native application
  api/                    FastAPI entry point
  ops-console/            restricted internal web console
services/
  workflow-worker/        durable task workflows and activities
  indexer-worker/         repository analysis and incremental indexing
packages/
  contracts/              OpenAPI-derived TypeScript/Python contracts
  agent-core/             state machine, prompts, budgets, policies
  context-engine/         retrieval and repository model
  model-gateway/          provider adapters and usage tracking
  sandbox-sdk/            internal sandbox provider interface
  verification/           check discovery, execution, and result schema
  github-integration/     app auth, webhooks, branches, PRs
  security/               authorization, redaction, policy primitives
infra/
  terraform/
  environments/
images/
  sandbox-node/
  sandbox-python/
evals/
  fixtures/
  tasks/
  scoring/
docs/
  architecture/
  runbooks/
```

## 6. Core component specifications

### 6.1 Mobile application

Required screens:

1. Welcome, account authentication, and terms/privacy consent.
2. GitHub connection and installation selection.
3. Repository picker with access status and support warnings.
4. Project list showing environment-neutral health, active tasks, and recent results.
5. Project overview with repository, default branch, last indexed commit, and task history.
6. Task composer with FIX/MODIFY selection, text input, attachments reserved for later, autonomy indicator, and estimated usage.
7. Task live view with a concise timeline: understanding, inspecting, planning, changing, testing, and reviewing.
8. Approval sheet that states exact action, risk, scope, and consequences.
9. Result view with root cause or implementation summary, files affected, verification matrix, unresolved risks, and PR action.
10. Mobile diff view: file summaries first, expandable hunks second, raw output last.
11. Notification inbox.
12. Project settings, GitHub access, budgets, retention, and deletion.

Implementation requirements:

- REST for commands and queries.
- Server-sent events in the foreground with cursor-based replay; push notifications when backgrounded.
- Local cache for projects and task summaries, but the server remains authoritative.
- Idempotency keys for task creation and approvals.
- Deep links from notifications to the exact task or approval.
- Accessibility labels, dynamic type, screen-reader checks, reduced motion, and sufficient color contrast.
- Redact secrets and very large logs in the client as well as the server.

### 6.2 API and control plane

Organize the FastAPI application into modules:

- Identity and sessions
- Organizations, memberships, and roles
- GitHub installations and repositories
- Projects and repository snapshots
- Tasks, messages, task events, and cancellation
- Approvals and policies
- Artifacts, diffs, verification, and pull requests
- Notifications
- Usage, quotas, and billing entitlements
- Audit and administrative operations

The API validates authorization at the resource boundary, not only at routes. Every query must be tenant-scoped. Background workers receive short-lived, task-scoped capabilities rather than broad service credentials.

### 6.3 GitHub integration

Build a GitHub App, not a broad OAuth application.

Initial permissions should be limited to:

- Repository metadata: read
- Contents: read and write only when creating the agent branch
- Pull requests: read and write
- Checks/statuses: read where useful
- Commit history: read

Do not request administration, environments, deployments, actions secrets, or organization-wide access in the MVP.

Flow:

1. User authenticates to Pocket Engineer.
2. User installs the GitHub App on selected repositories.
3. Signed webhooks synchronize installations, repository access, pushes, and deleted/renamed repositories.
4. Backend obtains a short-lived installation token only when needed.
5. Indexer records a snapshot for the selected commit SHA.
6. Each task uses an immutable base SHA and a new branch such as `pocket/<short-task-id>-<slug>`.
7. The backend, not the model or sandbox, creates the final branch/PR using a patch or commits exported from the sandbox.

Handle revoked installations, force pushes, branch protection, repository archival, large-file storage, submodules, and fork restrictions explicitly.

### 6.4 Sandbox service

Every task receives an isolated workspace tied to an exact repository SHA.

Lifecycle:

```text
Requested → Provisioning → Cloning → Preparing → Ready
          → Running → Exporting artifacts → Destroying → Destroyed
```

Controls:

- Non-root user, read-only base image, resource limits, process limits, and hard wall-clock timeout.
- Separate project/task identity and no cross-task shared filesystem.
- Ephemeral clone credentials; remove them immediately after checkout.
- No cloud metadata service access.
- Deny network egress by default. Resolve network requests through a policy proxy with domain, method, and size controls.
- No production secrets. Test credentials, if later allowed, are brokered as short-lived capabilities and never shown to the model.
- Capture stdout/stderr with server-side secret redaction and output-size limits.
- Record command, working directory, exit code, duration, resource use, and policy decision.
- Destroy the sandbox after artifact export, while retaining policy-governed logs and patches.
- Maintain language-specific, scanned base images. Pin image digest in each task record.

Define an internal `SandboxProvider` interface for create, exec, stream, upload, download, snapshot, cancel, and destroy. This prevents provider lock-in and enables a later Firecracker-based fleet.

### 6.5 Context engine

Do not build a heavyweight graph database first. Build a layered repository index:

1. Repository manifest: files, sizes, hashes, languages, ignored/generated classification.
2. Exact text index: ripgrep-compatible search against the checked-out snapshot.
3. Symbol index: tree-sitter and language-server output for definitions, references, imports, and signatures.
4. Chunk index: code-aware chunks with embeddings stored in pgvector.
5. Lightweight relationship graph: file imports, symbol references, test-to-source associations, and package boundaries in PostgreSQL.
6. Git context: recent commits, blame for retrieved regions, changed-file history, and related PR metadata where permitted.

Retrieval uses reciprocal/rank fusion across exact, symbol, semantic, dependency, and Git signals. Retrieved context includes provenance: repository, SHA, path, line range, retrieval reason, and confidence. Generated/vendor/binary files are excluded unless explicitly relevant.

Indexing strategy:

- Full initial scan on repository connection.
- Incremental re-index on push webhook using changed paths and content hashes.
- Snapshot index by commit SHA so an agent never mixes code from different revisions.
- Cache parse and embedding results by content hash across commits within the same tenant.
- Refuse or degrade gracefully when limits are exceeded; never silently omit most of a repository.

### 6.6 Model gateway

The gateway owns:

- Provider authentication and model aliases.
- Structured request/response schemas.
- Tool-call validation.
- Prompt versioning and experiment assignment.
- Token, latency, error, and cost metering.
- Retry policy and safe fallback.
- Context and output limits.
- Sensitive-data redaction and logging policy.
- Per-task budgets and kill switches.

Use one strong model first. Add smaller-model routing only after evals demonstrate that it does not reduce task success. Never change model or prompt versions in production without recording the version on each trajectory and running regression evaluations.

### 6.7 Agent orchestrator

Use one orchestrator with explicit roles or phases, not multiple autonomous agents. The workflow state is durable and observable:

```text
created
  → queued
  → provisioning
  → indexing/waiting_for_index
  → investigating
  → planning
  → waiting_for_approval (only when policy requires)
  → implementing
  → verifying
  → repairing (bounded loop, maximum three attempts initially)
  → ready_for_review
  → creating_pr
  → completed

Terminal alternatives: failed, cancelled, timed_out, policy_blocked
```

Each phase emits structured evidence and a user-safe summary. Tool calls are requests to a policy broker, not direct model capabilities.

The task record includes:

- User goal and clarified constraints
- Base repository and exact SHA
- Detected environment and commands
- Investigation findings with evidence
- Proposed plan and risk level
- Tool calls and observations
- Patches and commits
- Verification attempts and outcomes
- Remaining uncertainties
- Model, prompt, sandbox image, and policy versions
- Usage and cost

### 6.8 Tool-policy broker

Every tool has a typed input schema, output cap, risk category, and authorization rule.

Risk classes:

| Class | Examples | Default policy |
|---|---|---|
| Read | list files, search, read Git history | automatic within repository |
| Local mutation | edit file, install dependency in sandbox | automatic in Assisted mode after plan; fully audited |
| External read | fetch public package/docs endpoint | allow-list or approval |
| Git write | create remote branch or PR | explicit approval in MVP |
| Secret-bearing | use test credential | explicit policy and approval |
| Production/destructive | deploy, merge, delete, database mutation | unavailable in MVP |

The backend enforces policy even if repository text or a model response asks otherwise.

### 6.9 Verification engine

Verification should discover the repository's own truth sources before inventing commands:

1. Read package manifests, lockfiles, CI workflows, contributor docs, and existing scripts as untrusted evidence.
2. Select checks by change impact and known project configuration.
3. Run formatting/check-only, lint, type checking, compilation, unit tests, relevant integration tests, and smoke start when supported.
4. Record every command, exit status, duration, and artifact.
5. Detect flaky results by retrying only when policy permits and label retries honestly.
6. Compare before/after reproduction for bug fixes when feasible.
7. Fail closed: if a required check cannot run, report `not run` or `blocked`, never passed.

Result schema:

```text
check name
category
command or procedure
status: passed | failed | blocked | not_applicable | skipped
duration
output artifact
attempt count
required/optional
reason
```

The agent may claim `verified` only if all required checks pass and there is positive evidence for the requested behavior. Compilation alone is not behavioral verification.

### 6.10 Diff and result experience

Generate two representations from the same canonical Git diff:

- Summary: intent, root cause, changed behavior, affected files, risk, verification, and known limitations.
- Code: file list, expandable hunks, additions/deletions, and full patch download where appropriate.

The model may explain the diff but may not define it. The displayed patch hash must match the patch used to create the PR. If the base branch advances, mark the result stale and require rebase/reverification before PR creation.

## 7. Data model

Minimum relational entities:

- `users`
- `organizations`
- `memberships` with owner/admin/member/viewer roles
- `sessions` and `devices`
- `github_installations`
- `repositories`
- `projects`
- `repository_snapshots`
- `index_jobs`
- `files`
- `symbols`
- `code_chunks` with vectors
- `relationships`
- `tasks`
- `task_messages`
- `task_events`
- `task_steps`
- `tool_invocations`
- `approvals`
- `sandbox_runs`
- `patches`
- `verification_runs`
- `verification_checks`
- `git_outputs` for branches/commits/PRs
- `artifacts`
- `notifications`
- `usage_ledger`
- `entitlements`
- `audit_events`
- `project_memory_items` reserved for Phase 2

Important design rules:

- Use globally unique, non-sequential public IDs.
- Put `organization_id` on tenant-owned records and enforce tenant filtering consistently.
- Store immutable task events append-only; build current task state from durable workflow plus projections.
- Keep large logs and patches in object storage with checksums; store metadata and access policy in PostgreSQL.
- Encrypt sensitive integration tokens using envelope encryption and rotate keys.
- Make deletion asynchronous but traceable, including derived indexes and objects.

## 8. API and event contract

Representative API surface:

```text
POST   /v1/github/installations/link
GET    /v1/repositories
POST   /v1/projects
GET    /v1/projects
GET    /v1/projects/{project_id}
POST   /v1/projects/{project_id}/reindex

POST   /v1/projects/{project_id}/tasks
GET    /v1/tasks/{task_id}
POST   /v1/tasks/{task_id}/messages
POST   /v1/tasks/{task_id}/cancel
GET    /v1/tasks/{task_id}/events?after=<cursor>
GET    /v1/tasks/{task_id}/result
GET    /v1/tasks/{task_id}/diff

POST   /v1/approvals/{approval_id}/decision
POST   /v1/tasks/{task_id}/pull-requests

POST   /v1/webhooks/github
GET    /v1/usage
DELETE /v1/projects/{project_id}
```

Core event names:

```text
task.created
task.state_changed
task.progress_updated
task.evidence_added
task.approval_requested
task.approval_resolved
task.verification_updated
task.result_ready
task.failed
task.cancelled
pull_request.created
repository.index_started
repository.index_completed
repository.access_revoked
```

All create/mutation endpoints accept idempotency keys. Events have monotonically increasing per-task cursors so mobile clients can disconnect and replay without gaps.

## 9. End-to-end task sequence

1. Mobile submits a task with project, user goal, autonomy level, and idempotency key.
2. API authorizes the user, checks entitlement/quota, writes the task, and starts a durable workflow.
3. Workflow pins the repository base SHA and ensures the matching index exists.
4. Sandbox is provisioned and clones the exact SHA using a short-lived token.
5. Agent performs read-only investigation using repository retrieval and sandbox tools.
6. Agent produces a structured plan, suspected impact, and verification plan.
7. Policy engine decides whether implementation may continue or requires approval.
8. Agent edits only inside the task sandbox.
9. Verification engine runs discovered and change-specific checks.
10. On failure, the agent receives bounded diagnostic context and may repair up to the configured attempt limit.
11. Backend exports patch, logs, results, and checksums; sandbox is destroyed.
12. Result view shows evidence, diff summary, verification, costs, and residual risk.
13. User approves PR creation.
14. Git service revalidates access and base freshness, creates a branch/commit, and opens the PR.
15. GitHub webhook reconciles the PR state. Task completes and the user receives a notification.

Cancellation must propagate to model calls, sandbox commands, and workflow activities. A cancelled task must never create a remote branch after cancellation wins the race.

## 10. Security and privacy plan

### 10.1 Threat model before coding

Model at least these threats:

- Malicious repository instructions and prompt injection.
- Dependency install scripts attempting credential or network exfiltration.
- Cross-tenant data access through APIs, indexes, caches, logs, or sandbox reuse.
- GitHub token theft or permission escalation.
- Untrusted command execution escaping the sandbox.
- Source code or secrets leaking to model providers or telemetry.
- Forged GitHub webhooks and replay attacks.
- Agent creating an overly broad or malicious patch.
- User-account takeover and unauthorized PR creation.
- Abuse that turns sandboxes into mining, scanning, or denial-of-service infrastructure.

### 10.2 Required controls

- Treat repository content and tool output as untrusted data; wrap it with provenance labels and never concatenate it into system authority.
- Enforce all permissions outside the model in a deterministic policy service.
- Use least-privilege GitHub App scopes and short-lived installation tokens.
- Encrypt in transit and at rest; envelope-encrypt stored credentials.
- Separate production, staging, and development cloud accounts and data.
- Isolate sandboxes at the microVM/runtime boundary, not merely by application convention.
- Block metadata services and default-deny egress.
- Maintain server-side secret detection/redaction before model calls and logs.
- Require recent authentication for integration changes and PR creation; add device/session management.
- Verify webhook signatures and delivery IDs; make webhook handlers idempotent.
- Use signed artifact URLs with short expiry and tenant authorization.
- Log privileged access and provide an immutable audit trail.
- Scan dependencies, containers, and infrastructure code in CI.
- Perform external penetration testing before GA and after major sandbox or auth changes.
- Create incident response, credential rotation, breach notification, and customer deletion runbooks.

### 10.3 Privacy and training data

Default customer code and trajectories to no-training. Product analytics should use metadata and carefully classified events. Any future training program must be separate, explicit, revocable where feasible, tenant-controlled, and transparent about data categories, retention, subprocessors, and model-provider handling.

Define retention by artifact class: source snapshots, task transcripts, logs, patches, model inputs/outputs, audit events, and billing records. Provide project deletion and organization export before paid launch.

## 11. Testing and evaluation strategy

### 11.1 Conventional testing

- Unit tests for authorization, policies, state transitions, retrieval ranking, parsers, diff generation, redaction, and billing.
- Contract tests for mobile/API schemas, GitHub webhooks, model adapters, and sandbox adapters.
- Integration tests with local PostgreSQL, Redis, object storage, and a workflow test environment.
- Sandbox security tests for escape attempts, network policy, filesystem isolation, process limits, metadata access, and credential lifetime.
- End-to-end tests against controlled GitHub organizations and fixture repositories.
- Mobile UI tests for onboarding, task lifecycle, offline/reconnect, approvals, cancellation, diff viewing, and deep links.
- Load tests for event fan-out, indexing bursts, webhook storms, and concurrent task starts.
- Disaster-recovery exercises for database restore, workflow replay, provider outage, and credential compromise.

### 11.2 Agent evaluation harness

Create the evaluation harness before prompt tuning. Each fixture task includes:

- Repository and pinned commit
- User request
- Expected behavior or root cause
- Allowed/forbidden files or behaviors where appropriate
- Hidden tests
- Security traps and prompt-injection fixtures
- Time and cost budget
- Scoring rubric

Score:

- Behavioral task success
- Existing-test preservation
- Hidden-test success
- Patch minimality and relevance
- Security/policy compliance
- False-success rate
- Human-review quality
- Time and total cost
- Reproducibility

Maintain separate sets for development, regression, security, and holdout evaluation. A model or prompt change cannot ship if it improves a headline average while materially regressing security or false-success results.

### 11.3 Initial release gates

Suggested gates, to be calibrated after the first benchmark exists:

- At least 70% verified success on the supported-task holdout set.
- Fewer than 2% false-success reports; zero known false claims caused by representing skipped checks as passed.
- 100% policy pass on critical prompt-injection and secret-exfiltration fixtures.
- At least 95% successful sandbox teardown within the cleanup SLO, with reconciliation for the remainder.
- At least 99.5% crash-free mobile sessions during beta.
- API/workflow availability of 99.5% in beta, with a GA target of 99.9% after evidence supports it.
- No open severity-1 or severity-2 security defects at GA.
- All data deletion, token revocation, and account-recovery flows tested.

## 12. Observability and operations

Use a shared correlation chain: request ID → task ID → workflow ID → sandbox ID → model request ID → tool invocation ID → artifact ID.

Dashboards:

- Task funnel and state duration
- Task success, false-success, retry, cancellation, and timeout rates
- Sandbox provision time, command failures, resource use, leaked-sandbox reconciliations
- Model latency, errors, tokens, cost, and result quality by version
- Indexing queue, freshness, duration, and repository-size distribution
- GitHub webhook delay/failure and PR creation failures
- Mobile crash-free sessions, API latency, stream reconnects, and notification delivery
- Security policy denials, authentication anomalies, and egress blocks
- Unit economics by task, user, plan, and repository class

Alert on user-impacting symptoms, not every internal retry. Create runbooks for model outage, sandbox-provider outage, GitHub degradation, workflow backlog, database saturation, notification failure, runaway spend, suspected exfiltration, and orphaned resources.

Initial service objectives:

- p95 API reads under 500 ms excluding external-provider work.
- p95 first progress event under 3 seconds after task acceptance.
- p50 warm sandbox ready under 45 seconds; p95 under 120 seconds.
- No more than one minute of task-event loss after a client reconnect; expected result is zero due to replay.
- Recovery-point objective under 15 minutes and recovery-time objective under 4 hours for the MVP control plane; tighten after GA.

## 13. CI/CD and environments

Environments:

- Local: emulated dependencies and fixture repositories; never real customer tokens.
- Development: shared engineering environment with synthetic data.
- Staging: production-like, separate accounts/keys, controlled GitHub org, release candidate validation.
- Production: isolated account, restricted access, customer data.

Pull-request pipeline:

1. Format and static checks.
2. Unit and contract tests.
3. Dependency, secret, container, and infrastructure scanning.
4. Build API, worker, mobile, and sandbox image artifacts.
5. Run targeted agent evaluation smoke set when agent/context/prompt code changes.
6. Generate signed artifacts and software bill of materials.

Release pipeline:

- Apply database migrations with expand/migrate/contract discipline.
- Deploy backend canary, verify health and synthetic task, then progress rollout.
- Version prompts and model routing independently but through the same approval/evaluation process.
- Use remote feature flags with safe defaults for autonomy, languages, repository sizes, and providers.
- Release mobile builds to internal channels, then beta, then phased store rollout.
- Maintain rollback paths for code, prompts, routing config, sandbox image, and schema-compatible changes.

## 14. Delivery roadmap: kickoff to GA

The work should produce vertical, demonstrable slices rather than isolated infrastructure projects.

### Phase 0 — Definition and risk retirement (Weeks 1–2)

Goals:

- Convert the vision into an MVP product requirements document and support policy.
- Define core user journey and clickable mobile prototype.
- Create threat model and data classification.
- Spike GitHub App auth, sandbox isolation, durable cancellation, and one end-to-end model/tool call.
- Establish baseline evaluation fixtures: at least 20 realistic tasks across TypeScript and Python.
- Decide build-versus-buy for sandbox and authentication using written criteria.
- Set analytics taxonomy and success metrics.

Exit criteria:

- One command can provision a disposable sandbox, clone a fixture repo without persisting credentials, run tests, export a patch, and destroy the environment.
- GitHub permissions are reviewed and accepted.
- Architecture decision records exist for major choices.
- Scope, unsupported cases, launch gates, and incident ownership are signed off.

### Phase 1 — Product and platform skeleton (Weeks 3–5)

Backend:

- Create repository, CI, environments, infrastructure modules, migrations, and API skeleton.
- Implement accounts, organizations, memberships, sessions, project CRUD, audit events, and feature flags.
- Register GitHub App, installation flow, webhook verification, repository list, and revocation handling.
- Set up workflow engine, task schema, event log, object storage, and usage ledger.

Mobile:

- Establish design system, navigation, authentication, GitHub connect, repository picker, project list, and project detail skeleton.
- Generate typed API clients from the contract.
- Implement local caching, event-stream client, reconnect, and error states.

Platform:

- Establish metrics, traces, logs, secrets, backups, and access controls.
- Implement sandbox provider adapter and scanned Node/Python base images.

Exit criteria:

- A tester can sign in on a device, install the GitHub App, select a repository, create a project, and see a durable placeholder task update in real time.
- Access revocation removes future repository access.
- All mutations appear in the audit trail.

### Phase 2 — Read-only investigation and repository intelligence (Weeks 6–9)

- Implement snapshot-pinned clone and indexing workflows.
- Detect languages, frameworks, package managers, CI commands, and repository limits.
- Build manifest, exact search, symbol parsing, embeddings, relationship index, and Git context.
- Implement model gateway, prompt registry, structured outputs, budgets, and redaction.
- Implement read-only tools and policy broker.
- Build agent understand/inspect/plan phases with evidence citations.
- Add mobile investigation timeline and report view.
- Expand eval set to at least 60 investigation/root-cause tasks.

Exit criteria:

- On supported fixture repositories, the agent can identify relevant code and produce an evidence-backed diagnosis without mutation.
- Indexes remain tied to exact SHAs and update after push webhooks.
- Repository prompt-injection fixtures cannot cause forbidden tool use or secret access.

### Phase 3 — Code change, verification, diff, and pull request (Weeks 10–14)

- Add sandbox file-edit and command tools with schemas, limits, and audit output.
- Implement plan-to-patch workflow and bounded repair loop.
- Implement check discovery, verification matrix, baseline/after comparison, and artifact handling.
- Implement semantic diff summary and expandable mobile diff.
- Export canonical patch/commits with checksums.
- Implement approval model and PR creation with base-freshness checks.
- Add cancellation throughout the workflow and race-condition tests.
- Add quotas, per-task cost caps, timeout handling, and cleanup reconciliation.
- Expand evals to at least 100 fix/modify tasks with hidden tests.

Exit criteria:

- Internal users complete the foundational workflow end to end from a physical phone.
- A task cannot write to GitHub without a recorded approval.
- A PR's patch hash matches the reviewed patch.
- Failed, skipped, and blocked checks are represented accurately.
- Sandboxes are destroyed and credentials invalidated after every terminal task state.

### Phase 4 — Mobile trust UX and background operation (Weeks 15–18)

- Refine task composer, progress language, evidence expansion, result hierarchy, and approval clarity.
- Add task continuation after app termination, push notifications, deep links, and notification inbox.
- Implement graceful offline/reconnect behavior and cursor replay.
- Add stale-base warnings, re-run/rebase workflow, and recoverable failures.
- Complete account, device, session, integration, project retention, and deletion controls.
- Conduct accessibility audit and cross-device testing.
- Build restricted operations console for task inspection, user support, redacted artifact access, and provider kill switches.

Exit criteria:

- A user can start a task, close the app, receive an approval/completion notification, return to a coherent timeline, and safely create a PR.
- No core flow requires raw logs or desktop-sized code review.
- Support staff can diagnose failures without unrestricted source-code access.

### Phase 5 — Security, reliability, and private alpha (Weeks 19–22)

- Run structured internal dogfood across real consenting repositories.
- Conduct sandbox escape, authorization, prompt-injection, dependency-script, and webhook testing.
- Perform backup restore and provider outage exercises.
- Add rate limits, abuse detection, task admission control, and spend circuit breakers.
- Tune retrieval and prompts only through versioned eval experiments.
- Create customer support, incident response, deletion, GitHub revocation, and outage runbooks.
- Publish security overview, privacy policy, terms, subprocessor list, support matrix, and status page.

Alpha cohort:

- 20–30 trusted users.
- Repository access is allow-listed.
- Human review of all task outcomes before remote Git write, in addition to user approval.
- Daily quality and incident review.

Exit criteria:

- At least 200 real consented tasks completed.
- Quality gates show a credible path to beta targets.
- No unresolved critical security issue.
- Cost per successful task is measured by repository/task class.
- Top failure modes have owners and remediation plans.

### Phase 6 — Closed beta and product-market validation (Weeks 23–26)

- Expand to 100–300 invited users in staged cohorts.
- Add subscription/entitlement plumbing, usage display, and hard limits; avoid optimizing pricing before cost data exists.
- Improve onboarding and unsupported-repository messaging.
- Add in-product feedback attached to task trajectory and outcome.
- Run weekly failure taxonomy and benchmark updates.
- Introduce controlled provider fallback only if tested.
- Complete external penetration test and remediate findings.

Measure:

- Verified task success and first-attempt success.
- PR creation and PR acceptance/merge rate.
- False-success and regression rate.
- Median time to verified result.
- Human intervention and cancellation rate.
- Week-4 retention for users who completed a successful task.
- Cost per attempted and successful task.

Exit criteria:

- Release gates in Section 11 are met for at least four consecutive weeks.
- User interviews confirm the summary/verification experience supports informed trust.
- Support load and unit economics fit the planned public cohort.
- Store review, privacy disclosures, and account deletion are ready.

### Phase 7 — GA preparation and controlled launch (Weeks 27–30)

- Freeze MVP scope except launch blockers.
- Complete load/capacity test, disaster recovery exercise, key rotation, dependency audit, and final threat-model review.
- Establish on-call rotation, severity definitions, response targets, escalation paths, and public status communication.
- Create staged store rollout and invite/rate-limit controls.
- Finalize plans and usage pricing from measured costs.
- Build launch analytics and cohort dashboards.
- Prepare customer documentation: getting started, permissions, supported repositories, approvals, data handling, troubleshooting, and deletion.

Launch sequence:

1. Employee release.
2. Trusted alpha upgrade.
3. 5% beta cohort.
4. 25% cohort after 72 hours without regression.
5. 50% cohort after capacity and support review.
6. Controlled GA with waitlist/admission limits if compute supply or quality requires it.

GA is complete only when the service is operable, supportable, measurable, and reversible—not merely when the app is in stores.

## 15. Workstream ownership

| Workstream | Directly responsible | Key partners |
|---|---|---|
| Product scope and metrics | Product lead/founder | Design, engineering lead |
| Mobile experience | Mobile engineer | Designer, backend |
| API/data/auth | Backend engineer | Security, mobile |
| Agent/context/evals | Agent engineering lead | QA/evals, backend |
| Sandbox/platform | Platform engineer | Security, agent team |
| GitHub integration | Full-stack/backend engineer | Security, mobile |
| Verification/evaluation | QA/evals engineer | Agent and platform engineers |
| Security/privacy | Fractional security lead initially | Every owner |
| Operations/support | Engineering lead through alpha, then named owner | Platform, product |

No critical subsystem should have only one person capable of operating it by beta.

## 16. Initial backlog by epic

### Epic A — Identity and tenancy

- Authentication, refresh/session rotation, device list, logout-all.
- Organizations, memberships, invitation, role checks.
- Tenant-scoped repository pattern and authorization test helpers.
- Account export and deletion scaffolding.

Acceptance: users cannot infer or access another organization's objects through IDs, search, events, artifacts, caches, or timing-sensitive endpoints.

### Epic B — GitHub connection

- App manifest/configuration, installation callback, repository synchronization.
- Signed webhook receiver with replay protection.
- Installation token broker and revocation.
- Branch/commit/PR creation and reconciliation.

Acceptance: a revoked installation blocks the next operation immediately and leaves an audit event; no long-lived GitHub token enters a sandbox.

### Epic C — Durable task engine

- State machine, workflow, activity retry classifications, cancellation.
- Append-only events, SSE replay, push trigger.
- Task admission, concurrency, budgets, and timeout.

Acceptance: worker restarts do not lose or duplicate a task; repeated client submissions and webhook deliveries are idempotent.

### Epic D — Sandbox and tools

- Provider adapter, lifecycle controller, cleanup reconciler.
- Node/Python images, clone, exec, file access, patch export.
- Egress proxy, metadata blocking, resource policy, redaction.

Acceptance: security fixtures cannot reach cloud metadata, other sandboxes, control-plane credentials, or non-allowed external hosts.

### Epic E — Repository intelligence

- Snapshot manifest, parser pipeline, vectorization, Git context.
- Exact/symbol/semantic APIs and fused ranking.
- Incremental indexing, limits, and freshness indicators.

Acceptance: every retrieved span identifies its commit and path; cross-commit and cross-tenant contamination tests pass.

### Epic F — Agent and model gateway

- Versioned prompts, schemas, tool loop, evidence model.
- Provider metering, budgets, retry/fallback classification.
- Investigation, planning, implementation, repair, reporting.

Acceptance: malformed or adversarial model output cannot directly invoke a tool or bypass policy.

### Epic G — Verification and result

- Command discovery, check runner, artifacts, verification matrix.
- Canonical diff, semantic summary, stale-base handling.
- PR approval and hash binding.

Acceptance: a user can distinguish passed, failed, skipped, blocked, and not-applicable checks; PR contents equal reviewed contents.

### Epic H — Mobile trust loop

- Onboarding, projects, task composer, timeline, result, diff, approval.
- Notifications, deep links, reconnect, offline and terminal states.
- Accessibility and telemetry.

Acceptance: foundational workflow completes on representative iOS and Android devices without requiring a desktop.

### Epic I — Operations and commercialization

- Usage ledger, entitlements, plan limits, circuit breakers.
- Operations console, audit search, support impersonation prohibition or tightly controlled break-glass.
- Runbooks, status page, incident process, billing integration.

Acceptance: the team can explain and cap the cost of every task, diagnose a failed task, revoke access, and remove customer data.

## 17. Metrics and decision framework

North star:

> Verified engineering tasks completed autonomously per active developer.

Guardrail metrics:

- False-success rate
- Security/policy violation rate
- Regressions introduced
- User reversal rate after PR creation
- Cost per successful task
- p95 task duration
- Support contacts per 100 tasks
- Repository revocation/deletion completion time

Funnel:

```text
Account created
→ GitHub connected
→ Repository selected
→ First task started
→ Investigation completed
→ Verified result produced
→ PR created
→ PR merged externally
→ Second task within 14 days
```

Do not optimize prompt volume, tokens, or lines changed as success metrics.

## 18. Cost and capacity controls

Meter per task:

- Model input/output/cached tokens by phase and model version
- Sandbox provision and CPU/memory minutes
- Storage and egress
- Indexing compute and embeddings
- GitHub/API requests
- Notification and observability volume

Controls:

- Organization concurrency limits.
- Maximum task wall time, model calls, tokens, command duration, and repair attempts.
- Repository-size admission limits.
- Warm pools sized from demand, with cold fallback.
- Cached indexing and embeddings by content hash.
- Automatic termination on idle or policy breach.
- Provider and global spend circuit breakers.
- User-visible estimates and honest stop reasons when budgets are reached.

Target healthy gross margin only after measuring the successful-task denominator. A cheap failed task is not efficient.

## 19. Risk register

| Risk | Early indicator | Mitigation | Owner |
|---|---|---|---|
| Incorrect code/false success | Hidden-test failures, rejected PRs | Strict verification, bounded scope, eval gates | Agent lead |
| Prompt injection/exfiltration | Forbidden tool requests, egress blocks | Policy broker, redaction, isolation, security fixtures | Security/platform |
| Sandbox escape | anomalous syscalls/network, test findings | Managed isolation, hardening, pentest, rapid image revocation | Platform |
| Compute cost | rising cost per successful task | Budgets, caching, admission, routing only after evals | Engineering lead |
| Slow startup | sandbox p95 and task abandonment | warm pools, prebuilt images, staged progress | Platform/product |
| Large repo quality | retrieval miss and timeout rates | support limits, incremental index, repo-class benchmarks | Context owner |
| Provider outage | model/sandbox error spikes | durable retries, kill switches, tested adapters | Platform |
| GitHub permission distrust | install abandonment | minimal scopes, clear explanation, easy revoke | Product/security |
| Mobile review friction | result abandonment, desktop fallback | semantic diff, risk summary, approval clarity | Mobile/design |
| Scope explosion | slipped exit criteria | explicit non-goals and launch gate ownership | Product lead |
| Low retention | no second task after first success | focus on recurring FIX/MODIFY value and reliability | Product lead |
| Data/privacy concern | enterprise blocks, deletion requests | no-training default, retention controls, transparent docs | Privacy owner |

## 20. Phase 2 roadmap — richer mobile engineering (Months 8–12)

Only begin after the MVP trust and unit-economics gates hold.

Sequence:

1. Live application preview using sandbox port proxy and expiring authenticated URLs.
2. Browser agent with typed actions, screenshots, console/network capture, and deterministic replay artifacts.
3. Screenshot-to-fix: image upload, element/route inference, repository/runtime correlation, and visual comparison.
4. Project memory with user-visible, editable, provenance-backed facts and expiration.
5. Voice commands using speech-to-text and the same approval semantics as typed commands.
6. GitLab integration, then Bitbucket based on demand.
7. Limited BUILD templates for one opinionated stack.
8. Deployment to one low-risk target, beginning with preview deployments and explicit approval; production follows only after policy and rollback are proven.

Phase 2 exit: the agent can modify a web app, launch it, navigate the affected flow, capture evidence that behavior works, and offer a preview or approved deployment.

## 21. Phase 3 roadmap — application health automation (Months 13–18)

- Background and scheduled tasks with budget windows.
- Monitoring/error-provider integrations through least-privilege connectors.
- Automatic issue triage and investigation.
- Dependency and vulnerability update PRs.
- Performance regression investigation.
- Team roles, shared projects, richer audit, SSO preparation.
- Approval policies by action, repository, environment, team, and time.
- Deployment health checks and rollback workflow.
- Carefully bounded autonomous PR generation; merging remains separately governed.

Phase 3 exit: a team can ask Pocket Engineer to keep an application healthy and receive evidence-backed investigations and proposed PRs without initiating every task manually.

## 22. Phase 4 roadmap — proprietary intelligence (Month 18+)

Prerequisites:

- Explicit user/organization consent system.
- Strong anonymization/data-governance review.
- High-quality trajectory schemas and outcome labels.
- Reliable evaluation sets separated from training data.
- Sufficient volume of verified, diverse tasks.

Progression:

1. Use trajectories to improve retrieval, prompts, routing, and verifiers.
2. Train small classifiers/rankers for context selection, risk, command choice, and result quality.
3. Fine-tune specialized models for repository tasks where they beat frontier baselines on holdouts.
4. Add preference optimization only with reliable outcome and review signals.
5. Deploy hybrid routing based on quality, latency, privacy, and cost.

Do not train a general proprietary coding model simply because data exists. Require a measurable product advantage on verified tasks.

## 23. Definition of done

### A task is done when

- The requested outcome and constraints are recorded.
- The exact repository base SHA is recorded.
- Investigation evidence is available.
- The patch is canonical and checksummed.
- Every required verification check passed, or the task is explicitly reported as incomplete.
- Residual risk and unsupported checks are visible.
- The reviewed patch matches any created PR.
- The sandbox and temporary credentials are destroyed/revoked.
- Usage and audit events are complete.
- The user receives the result or actionable failure state.

### The MVP is done when

- The foundational workflow works on both iOS and Android for supported repositories.
- Quantitative quality and security gates hold across evals and beta traffic.
- A provider or worker failure does not lose task state or create duplicate external actions.
- Access revocation and customer deletion work end to end.
- On-call, support, runbooks, capacity, billing limits, and rollback are operational.
- Users demonstrate repeat usage and accept a meaningful portion of generated PRs.

## 24. First 14 days: exact starting checklist

### Product and design

- Write a one-page MVP contract: supported users, repository types, task types, autonomy, and non-goals.
- Interview 10 target users about the last bug they needed to handle away from a laptop.
- Prototype onboarding, task progress, result, diff, and approval on a phone-sized canvas.
- Define task-success and false-success labeling rules.

### Engineering

- Create monorepo, owners, branch protection, CI, dependency update policy, and architecture-decision template.
- Implement a thin FastAPI endpoint and React Native app calling it in development.
- Create the GitHub App in a controlled test organization and prove short-lived clone plus PR creation.
- Build one disposable sandbox fixture: clone, install, test, patch, export, destroy.
- Stand up PostgreSQL, workflow engine, object storage, tracing, and secrets in development.
- Define task state, event, tool-call, verification, approval, and artifact schemas.

### Security and evaluation

- Complete first threat-model workshop.
- Classify source code, secrets, logs, prompts, outputs, and telemetry.
- Write prompt-injection and secret-exfiltration fixtures before agent implementation.
- Assemble 20 pinned repository tasks with reproducible expected outcomes and hidden tests.

### Management

- Assign one owner to every workstream and launch gate.
- Establish twice-weekly vertical demo, weekly eval review, and biweekly risk review.
- Record the four largest unknowns: sandbox isolation, task quality, mobile trust UX, and cost per successful task.
- End day 14 with a go/no-go review based on working spikes, not slideware.

## 25. Final milestone sequence

```text
M0 — Risk spikes work
  ↓
M1 — Phone connects a GitHub repository
  ↓
M2 — Read-only agent investigates with evidence
  ↓
M3 — Agent changes code and runs honest verification
  ↓
M4 — User reviews the exact patch and creates a PR
  ↓
M5 — Task survives backgrounding, retries, and provider failures
  ↓
M6 — Private alpha proves safety and operability
  ↓
M7 — Closed beta proves repeat value and unit economics
  ↓
M8 — Controlled GA
  ↓
M9 — Browser, screenshot, voice, preview, and deployment
  ↓
M10 — Continuous application health
  ↓
M11 — Permissioned proprietary intelligence
```

The governing rule is simple: do not advance because a feature exists. Advance when the previous milestone is safe, observable, repeatable, and measurably useful.
