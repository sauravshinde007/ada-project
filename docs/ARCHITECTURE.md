# System Architecture

## High-Level Architecture

```text
                    AI VTUBER APPLICATION

┌──────────────────────────────────────────────────────┐
│                    React Frontend                    │
│                                                      │
│  Chat UI    Avatar UI    Settings    Debug/Memory   │
│                     │                                │
│                 Three.js                             │
│                     │                                │
│                   VRM Model                          │
└─────────────────────┬────────────────────────────────┘
                      │ WebSocket / HTTP
┌─────────────────────▼────────────────────────────────┐
│                Node.js Backend                       │
│                                                      │
│  Conversation │ AI Orchestrator │ Event Bus         │
│  Memory       │ Emotion Engine  │ Tool Registry     │
└──────────┬──────────────┬───────────────┬───────────┘
           │              │               │
           ▼              ▼               ▼
      Local LLM       SQLite Memory    Future Tools
      llama.cpp                         Web/Git/etc.
```

## Repository Structure

```text
ai-vtuber/
├── frontend/
│   ├── public/
│   │   └── models/
│   │       └── character.vrm
│   └── src/
│       ├── components/
│       ├── avatar/
│       ├── chat/
│       ├── state/
│       ├── services/
│       ├── types/
│       └── main.tsx
│
├── backend/
│   └── src/
│       ├── api/
│       ├── ai/
│       │   ├── providers/
│       │   ├── prompts/
│       │   └── schemas/
│       ├── conversation/
│       ├── emotion/
│       ├── memory/
│       ├── events/
│       ├── tools/
│       ├── config/
│       └── server.ts
│
├── database/
│   ├── migrations/
│   └── schema/
│
├── shared/
│   └── src/
│       ├── events/
│       ├── schemas/
│       └── types/
│
├── ai-models/
│   └── README.md
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   ├── ROADMAP.md
│   └── AGENTS.md
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Architectural Rules

### Frontend

The frontend owns:

- rendering
- VRM model control
- user interaction
- chat presentation
- avatar animations
- local UI state

The frontend must not contain LLM/business logic.

### Backend

The backend owns:

- conversation orchestration
- LLM calls
- memory retrieval
- memory creation
- emotion decisions
- tool execution
- application events

### Shared

Shared types and event schemas live in `shared/` so frontend and backend do not duplicate contracts.

### AI Provider

The rest of the application must communicate with an abstraction such as:

```ts
interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}
```

The initial implementation will use local `llama.cpp`.

### Avatar

The rest of the application must communicate through an abstraction such as:

```ts
interface AvatarController {
  setExpression(name: string, intensity: number): void;
  playAnimation(name: string): void;
  lookAt(x: number, y: number): void;
}
```

The initial implementation uses Three.js + VRM.

### Memory

Start with SQLite. Do not introduce PostgreSQL/vector infrastructure until the simple memory system proves insufficient.

## Data Flow

```text
User message
    ↓
Conversation Manager
    ↓
Memory Retrieval
    ↓
Prompt Builder
    ↓
LLM Provider
    ↓
Structured Response
    ├── text
    ├── emotion
    ├── intensity
    └── animation
    ↓
Event Bus
    ├── Chat UI
    ├── Emotion Engine
    ├── Avatar Controller
    └── TTS (future)
```

## Security

Tool execution must be permissioned.

Never allow an LLM to execute arbitrary terminal commands, delete files, send messages, or modify the system without an explicit permission layer.
