# Coding Instructions for AI Coding Agents

This file applies to Antigravity and other coding agents working on this repository.

## Core Rule

Implement only the requested phase/task.

Do not prematurely implement future roadmap items.

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
- Prefer small modules with clear responsibilities.

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
