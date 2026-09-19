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
│  Memory       │ Emotion Engine  │ TTS Service       │
│  Tool Registry                                       │
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

### TTS Provider

The rest of the application must communicate with an abstraction rather than directly importing GPT-SoVITS throughout the application.

For example:

```ts
interface TTSProvider {
  synthesize(request: TTSRequest): Promise<TTSResult>;
}
```

A request should carry both text and vocal style information:

```ts
interface TTSRequest {
  text: string;
  emotion: string;
  intensity: number;
}
```

The initial implementation uses local GPT-SoVITS v2Pro.

The provider is responsible for translating application-level requests into GPT-SoVITS-specific inference parameters and reference-voice selection.

Current implementation:

```text
TTSService
    ↓
GPTSoVITSProvider
    ↓
GPT-SoVITS API
http://127.0.0.1:9880/tts
    ↓
GPT-SoVITS v2Pro
```

GPT-SoVITS-specific configuration is isolated from general conversation logic.

The local API is configured using:

```text
GPT_SoVITS/configs/ada_v2pro.yaml
```

The configuration uses the `custom` section of `TTS_Config` and the installed v2Pro weights:

```text
s1v3.ckpt
v2Pro/s2Gv2Pro.pth
```

The API currently runs on CPU to avoid competing for the limited VRAM of the RTX 3050 with the local llama.cpp LLM.

### TTS Text Preprocessor

LLM output should pass through a text-preprocessing layer before reaching the TTS provider.

Responsibilities include:

- normalizing unnecessary ALL-CAPS
- avoiding acronym/spelling pronunciation for ordinary words
- removing markdown
- handling unsupported symbols/emojis
- normalizing excessive punctuation
- preserving meaningful pauses

The rest of the application should not need to know about GPT-SoVITS's text-normalization requirements.

### Avatar

The rest of the application must communicate through an abstraction such as:

```ts
interface AvatarController {
  setExpression(name: string, intensity: number): void;
  playAnimation(name: string): void;
  lookAt(x: number, y: number): void;
  setTalking(active: boolean): void;
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
    └── Avatar Controller
```

## Security

Tool execution must be permissioned.

Never allow an LLM to execute arbitrary terminal commands, delete files, send messages, or modify the system without an explicit permission layer.

## Target Voice Data Flow

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
TTS Text Preprocessor
    ↓
TTS Provider
    │
    └── GPT-SoVITS
          ↓
       Audio
          ↓
    Event Bus
       ├── Chat UI
       ├── Audio Playback
       ├── Emotion Engine
       └── Avatar Controller
                              │
                              └── Talking / Lip Sync

```

TTS is an application capability, not an LLM responsibility. If TTS fails or is unavailable, the text response should still be delivered.

### Current Phase 7A Implementation

The current implementation extends the structured chat response with generated audio:

```text
LLM
 ↓
Structured ChatMessage
 ├── text
 ├── emotion
 ├── intensity
 ├── animation
 └── audioData
        ↑
        │
TTSService
 ↓
TTSPreprocessor
 ↓
GPTSoVITSProvider
 ↓
GPT-SoVITS /tts :9880
```

The backend currently sends generated audio as Base64 through the existing WebSocket/chat message path. The frontend creates basic browser audio playback from `audioData`.

This is a Phase 7A transport mechanism and is not the final streaming architecture.

### Current Voice Infrastructure

```text
GPT-SoVITS Main WebUI       → :9874
GPT-SoVITS TTS Inference UI → :9872
GPT-SoVITS API              → :9880
```

The API uses the local v2Pro configuration and reference-voice zero-shot synthesis.

## Voice Architecture

The long-term voice system should support multiple speaking styles without coupling the rest of Ada to one reference audio file.

```text
                         Emotion Engine
                              │
                   emotion + intensity
                              │
                              ▼
LLM text ──► TTS Preprocessor ──► TTS Provider
                                  │
                                  ├── reference voice
                                  ├── speaking style
                                  └── synthesis parameters
                                         │
                                         ▼
                                    GPT-SoVITS
                                         │
                                         ▼
                                       Audio
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                         Audio Output         Avatar Talking
```

  The first implementation can use one reference voice. Emotion-specific reference clips and speaking-style presets can be introduced later.

## Animation Architecture

The avatar supports skeletal animations by filtering and retargeting FBX animations onto the standard VRM humanoid skeleton.

```text
FBX Animation
        ↓
loadMixamoAnimation
        │ Discard .position and .scale tracks (prevent mesh deformation)
        │ Map raw FBX bone names (J_Bip_*) to VRM normalized bones
        │ Apply mathematical rest-pose correction:
        │ Q_corrected = Q_parentRestWorld * Q_animTrack * (Q_nodeRestWorld)^-1
        ↓
THREE.AnimationClip (quaternion tracks only)
        ↓
THREE.AnimationMixer (on vrm.scene)
        ↓
VRMHumanoid (Normalized Bones)
```

- **Rest-Pose Retargeting:** A robust mathematical delta is computed between the FBX source rig's arbitrary rest posture (usually A-pose) and the VRM's normalized T-pose. 
- **Root Orientation & Balance:** To prevent a global slant, the `Hips` bone is treated uniquely. The `restRotationInverse` is skipped for the Hips to preserve the absolute world orientation of the Mixamo root, maintaining the structural balance intended by the animation. All position tracks are filtered out to prevent mesh deformation.
- **Rest-Pose Retargeting:** A uniform rest-pose correction is applied to every bone:
  `Q_out = parentRestWorldQ × Q_track × restWorldQ⁻¹`
  This extracts only the delta rotation from the FBX rest pose. At the rest pose, the output is identity (VRM T-pose); during animation, the output is the motion delta only. No special-casing for any bone.
- **Root Cause of Previous Slant:** The FBX skeleton has a `Root` bone with 90° X rotation and `J_Bip_C_Hips` with 7.21° X rotation at rest. The combined world quaternion is ~97°. An earlier attempted fix incorrectly exempted Hips from the `restWorldQ⁻¹` step, which leaked the full ~97° pitch into the VRM normalized hips — causing the global forward slant. The uniform formula cancels this exactly at rest.
- Procedural idles (breathing/swaying) are overridden when a full-body skeletal animation is active.
- Procedural `lookAt` (gaze tracking) and expression overrides (talking lip-sync, emotion) run *after* the `AnimationMixer` updates, allowing dynamic facial expressions to override baked animation tracks.

