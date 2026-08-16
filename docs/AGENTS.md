# Coding Instructions for AI Coding Agents

This file applies to Antigravity and other coding agents working on this repository.

## Core Rule

Implement only the requested phase/task.

Do not prematurely implement future roadmap items.

The current development phase is **Phase 7: Voice / TTS**.

Phase 7A backend TTS integration has been implemented and the GPT-SoVITS v2Pro API has been independently verified. The complete user-facing Ada audio flow still requires final manual verification.

Remaining Phase 7 work includes:
- final end-to-end TTS verification
- talking-state synchronization
- avatar lip-sync
- emotion-aware TTS
- streaming/interruption

## Before Changing Code

1. Read `README.md`.
2. Read `docs/ARCHITECTURE.md`.
3. Read `docs/DESIGN.md`.
4. Read `docs/ROADMAP.md`.
5. Inspect the existing code before modifying it.
6. Identify existing interfaces and reuse them.

## Architecture Rules

- Keep frontend and backend responsibilities separate.
- Keep shared contracts in `shared/`.
- Do not put backend secrets in frontend code.
- Use interfaces for replaceable infrastructure.
- Do not couple application logic directly to a specific LLM provider.
- Do not couple application logic directly to the VRM implementation.
- Do not couple application logic directly to GPT-SoVITS.
- Prefer small modules with clear responsibilities.
- Keep TTS provider-specific configuration inside the TTS infrastructure layer.
- Emotion should remain an application-level concept that can be consumed by both avatar and TTS systems.

## Local-First Rule

The project should work without paid APIs whenever practical.

Preferred initial infrastructure:

- local LLM
- local SQLite
- local STT
- local TTS
- VRM rendered in browser

Paid/cloud services may be added later behind interfaces.

## AI Output Rule

LLM responses that control application behavior must use validated structured schemas.

Never parse arbitrary natural-language output to control avatar state or tools.

## Tool Safety

Never implement unrestricted shell access.

Potentially dangerous tools must have:

- explicit allowlists
- permission checks
- clear UI confirmation where appropriate
- logging

## Dependencies

Before adding a dependency:

1. Check whether the functionality can be implemented with an existing dependency.
2. Prefer mature, lightweight, open-source dependencies.
3. Avoid adding large frameworks without architectural justification.

## Code Quality

- TypeScript strict mode where practical.
- Meaningful names.
- Avoid giant files.
- Avoid duplicated business logic.
- Add error handling at infrastructure boundaries.
- Keep functions focused.
- Document non-obvious architectural decisions.

## Testing

When implementing a subsystem:

1. Add the smallest useful automated test.
2. Manually verify the user-facing behavior.
3. Do not claim a feature works without testing it.

## Git

Make small, logical commits.

Suggested format:

```text
feat: add VRM loader
feat: add local LLM provider
feat: add emotion response schema
fix: handle websocket reconnect
```

## Agent Communication

At the end of each task, report:

1. What changed.
2. Files created/modified.
3. How it works.
4. How it was tested.
5. Any known limitations.
6. The next recommended task.

Do not silently make unrelated architectural changes.

## TTS Rules

- Do not send raw LLM text directly to GPT-SoVITS.
- Pass generated text through a TTS preprocessing layer first.
- Normalize problematic ALL-CAPS text.
- Do not rely on capitalization to represent vocal emotion.
- Keep voice identity/reference selection separate from emotion selection.
- Keep GPT-SoVITS-specific paths and parameters out of general conversation logic.
- TTS failures must not crash the core chat system.
- If TTS is unavailable, Ada should still be able to return a normal text response.
- Avoid blocking the main conversation/event loop unnecessarily while audio is being generated.
- Design the TTS interface so the implementation can be replaced later.

## TTS Testing

When implementing TTS changes:

1. Test successful synthesis with a known reference voice.
2. Test text preprocessing, including ALL-CAPS input.
3. Test graceful behavior when GPT-SoVITS is unavailable.
4. Verify that the existing text-only chat path still works.
5. Verify the actual user-facing `LLM → TTS → browser audio` flow before marking Phase 7A complete.
6. Do not claim emotion-aware voice behavior is complete until it has been manually evaluated.

### Current TTS Environment

The local GPT-SoVITS setup currently exposes:

- Main WebUI: `http://127.0.0.1:9874`
- TTS inference UI: `http://127.0.0.1:9872`
- API: `http://127.0.0.1:9880`

The API uses `GPT_SoVITS/configs/ada_v2pro.yaml` with:

- `version: v2Pro`
- `s1v3.ckpt`
- `v2Pro/s2Gv2Pro.pth`
- CPU inference (`device: cpu`, `is_half: false`)

This CPU configuration is intentional for the current 4 GB RTX 3050 environment because llama.cpp also requires GPU VRAM.

### Current Phase 7A Status

Implemented and independently verified:

- TTS provider abstraction
- GPT-SoVITS provider
- TTS preprocessing
- TTS service/error handling
- audio delivery contract
- basic frontend audio playback
- GPT-SoVITS v2Pro API startup
- direct `/tts` synthesis with the reference voice

Do not start Phase 7B implementation until the complete Ada user-facing TTS flow has been manually verified.
