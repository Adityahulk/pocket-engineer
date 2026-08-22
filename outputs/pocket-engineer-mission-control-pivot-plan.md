# Pocket Engineer — Mission Control Pivot and Voice Plan

## Product decision

Reposition Pocket Engineer from a mobile coding agent to:

> **The mobile command center for autonomous software engineering.**

The existing investigate → change → verify → approve → PR workflow remains valuable, but it becomes an execution capability beneath the product rather than the product's identity.

## What changes

| Before | After |
|---|---|
| Projects list | Software estate with health and incidents |
| Coding tasks | Outcome-oriented Missions |
| One implicit agent | Visible AI Engineers routed by capability |
| Task composer first | Health, active work, and decisions first |
| Chat-style control | Voice call, mission brief, and status check-ins |
| “AI writes code” | “User manages autonomous engineering work” |
| Provider-specific execution | Provider-independent engineer adapters |

## Core information architecture

### Command Center

- Portfolio health summary
- Production incidents requiring attention
- Active missions and their stage
- AI engineers currently working
- Approval inbox
- Large “Call your engineer” action

### Software

- Environment-neutral health summary
- Open incidents
- Deployments and recent changes later
- Active and completed missions
- Voice or text mission brief

### Mission

- Outcome, priority, and owner
- Investigator, Engineer, Tester, Reviewer, and Deployer stages
- Evidence and confidence
- Verification matrix and exact patch
- Decisions/approvals
- PR or deployment result

### Engineer Call

- Full-screen call interface
- Natural speech-to-speech conversation
- Live listening/thinking/speaking states
- Interruption/barge-in
- Live transcript
- Mute and end controls
- Current software and mission context
- Mission draft card generated from the conversation
- Explicit tap confirmation before a mission starts

## Voice architecture

Use a provider-independent `VoiceProvider` boundary. The first production adapter uses the OpenAI Realtime API over WebRTC. Official OpenAI guidance recommends WebRTC for browser/mobile clients and speech-to-speech for low first-audio latency, natural turn-taking, barge-in, and realtime tool use.

Sequence:

```text
Mobile requests a short-lived voice client secret
→ Backend authenticates with the standard provider key
→ Mobile creates a WebRTC peer connection
→ Microphone audio streams directly over WebRTC
→ Remote audio plays as a live call
→ Data channel carries transcripts, state, and tool events
→ Voice engineer may draft a mission
→ User reviews and taps Start Mission
→ Existing verified execution workflow begins
```

Rules:

- Standard provider API keys remain server-side.
- Client secrets are short-lived and minted for one call.
- Call context contains project/mission summaries, not repository secrets or full source.
- The voice engineer never claims a test, change, or deployment occurred unless the control plane has evidence.
- Voice can explain, investigate, and draft. Remote Git writes, merges, deployment, rollback, and destructive actions require a visible approval.
- Every confirmed mission is represented in the normal event/audit model.
- A push-to-talk or text fallback remains available when audio permissions, network quality, or realtime service fail.

## Voice personality

The engineer should sound like a calm senior teammate on a phone call:

- Open with a contextual greeting: “Hey, I’m here. I can see Checkout is reporting an incident. Want the short version?”
- Acknowledge before solving.
- Ask one concise question at a time.
- Prefer plain language and short spoken turns.
- State uncertainty naturally.
- Offer the next decision, not a menu of technical internals.
- Confirm understanding before drafting consequential work.
- Use verbal progress markers: “I’m checking that now,” “I found the likely cause,” “I’ve put a mission on screen for you to approve.”
- Never read raw diffs, stack traces, hashes, or long logs aloud unless asked.
- Allow interruption immediately; do not finish a monologue after the user speaks.

## Backend changes

1. Add command-center summary endpoint.
2. Add health and incident summaries to software/project responses.
3. Present existing tasks as Missions while keeping compatible task endpoints.
4. Add engineer/provider metadata and routing boundary.
5. Add short-lived Realtime client-secret endpoint.
6. Build project/mission-safe voice context.
7. Add mission draft tool-event contract.
8. Preserve existing approval and PR safety gates.

## Mobile changes

1. Redesign home as Command Center.
2. Show production health, incidents, active missions, engineers, and approvals.
3. Rename user-facing Tasks to Missions.
4. Add a prominent call control on home and software screens.
5. Add native/web realtime voice transport adapters.
6. Add phone-call UI with transcript, status, mute, interruption, and end controls.
7. Add mission draft confirmation from a voice conversation.
8. Preserve mobile-friendly verification and exact-patch review.

## Frameworks

- Expo Router for native/web navigation.
- React Query for server-state synchronization.
- `react-native-webrtc` with its Expo config plugin for native WebRTC.
- Browser WebRTC APIs for web.
- FastAPI and HTTPX for short-lived session creation.
- OpenAI Realtime API as the first voice provider.
- Aider and provider adapters for execution; Pocket Engineer remains model-independent.

## Delivery sequence

1. Domain/API compatibility layer for Mission and Command Center.
2. Command Center home redesign.
3. Voice client-secret endpoint and safe contextual prompt.
4. Web and native WebRTC transport.
5. Call UI and live transcript.
6. Voice-to-mission draft and explicit start confirmation.
7. Rename remaining task language to mission language.
8. Automated API/mobile checks and mobile-viewport browser QA.

## Acceptance criteria

- Home answers “What is unhealthy, what is working, and what needs me?” without opening a project.
- A user can start an engineer call from the command center or a software card.
- The call supports listening, thinking, speaking, interruption, mute, end, and transcript states.
- Standard API credentials never enter the application bundle.
- The voice engineer can draft a mission but cannot start it without a tap.
- A confirmed mission enters the existing durable execution workflow.
- Existing test, diff, approval, and PR behavior remains intact.
- Web builds successfully; native configuration includes microphone permission and WebRTC support.

## Later integrations

After this slice, add Sentry first, then deployment/hosting health, then Datadog/CloudWatch based on demand. These connectors should generate normalized incidents and evidence, not separate product silos. Multi-agent/provider routing becomes meaningful only after Missions and Incidents are stable product abstractions.

Official voice transport reference: [OpenAI Realtime API with WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)

