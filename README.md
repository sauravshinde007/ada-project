# Ada — Local AI VTuber Personal Assistant

Ada is a local-first personal AI companion presented through an anime-style VRM avatar.

The project combines a local language model, persistent memory, structured AI responses, personality, emotion-driven avatar behavior, and local text-to-speech into one interactive assistant. The browser provides the visual experience while the Node.js backend coordinates conversation, memory, AI providers, avatar state, and voice generation.

Ada is designed around modular provider interfaces so individual AI systems can be replaced without rewriting the application.

---

## Project Overview

Ada is built around the following principles:

- **Local-first:** the core AI stack runs locally without requiring paid hosted AI APIs.
- **Modular:** LLM, memory, and TTS capabilities are isolated behind application interfaces.
- **Interactive:** the assistant is represented by a VRM avatar rather than a text-only interface.
- **Persistent:** conversational memory is stored locally with SQLite.
- **Structured:** LLM responses contain validated application state such as text, emotion, intensity, and animation.
- **Safe by design:** future system tools are intended to use explicit interfaces, permissions, and allowlists rather than unrestricted computer access.
- **Incremental:** each major subsystem is developed independently and integrated through clear contracts.

---

# Project Phases

Ada was developed incrementally through the following phases.

## Phase 1 — Foundation

Established the core application architecture.

- React + TypeScript + Vite frontend.
- Node.js + TypeScript backend.
- Express health endpoint.
- WebSocket communication.
- Shared frontend/backend types.
- Initial chat interface.
- Repository structure and development conventions.

---

## Phase 2 — VRM Avatar

Introduced Ada's visual identity.

- Three.js rendering.
- `@pixiv/three-vrm` integration.
- VRM model loading.
- Correct avatar orientation.
- Chest-up camera framing.
- Relaxed standing pose.
- Procedural idle breathing and body movement.
- Cursor-based look-at behavior.
- Idle gaze drift.
- Collapsible chat interface.
- Collapsible developer expressions interface.

---

## Phase 3 — Local LLM

Connected Ada to a local language model.

- Local `llama.cpp` inference.
- OpenAI-compatible local API.
- Qwen3-4B Q4_K_M model.
- GPU acceleration through llama.cpp.
- Replaceable LLM provider abstraction.
- Backend conversation generation.
- No dependency on a paid hosted LLM API.

---

## Phase 4 — Personality

Turned the language model into the Ada character.

- Centralized personality configuration.
- Character identity and behavioral rules.
- Casual conversational style.
- Context-aware responses.
- Configurable personality traits.
- Separation between personality instructions and infrastructure code.

Ada's personality is treated as application configuration instead of being scattered throughout the codebase.

---

## Phase 5 — Emotion System

Connected structured AI output to the avatar.

Ada responses use validated structured data containing fields such as:

```json
{
  "text": "Example response",
  "emotion": "excited",
  "intensity": 0.85,
  "animation": "happy"
}
```

The emotion system supports:

- Neutral
- Happy
- Sad
- Angry
- Excited
- Surprised
- Curious
- Confused
- Embarrassed
- Annoyed

The backend treats emotion as application-level state, while the frontend maps that state to avatar expressions and animations.

---

## Phase 6 — Persistent Memory

Added persistent conversational memory.

- SQLite-backed local storage.
- Memory management layer.
- Conversation context retrieval.
- Persistence across application sessions.
- Separation between memory storage and conversation orchestration.

The memory system remains local and does not require a hosted database.

---

## Phase 7 — Voice / TTS

Added local voice synthesis using GPT-SoVITS v2Pro.

The TTS architecture separates generic application-level voice requests from GPT-SoVITS-specific implementation details.

```text
Structured LLM response
        │
        ▼
   TTSService
        │
        ▼
 TTSPreprocessor
        │
        ▼
GPTSoVITSProvider
        │
        ▼
GPT-SoVITS API :9880
        │
        ▼
 Generated audio
        │
        ▼
    audioData
        │
        ▼
   WebSocket
        │
        ▼
 Browser Audio
```

The voice system includes:

- `TTSProvider` abstraction.
- `GPTSoVITSProvider`.
- `TTSPreprocessor`.
- `TTSService`.
- GPT-SoVITS v2Pro.
- Zero-shot reference voice synthesis.
- Markdown cleanup.
- Emoji removal.
- Excessive punctuation normalization.
- ALL-CAPS normalization.
- Common acronym preservation.
- Graceful TTS failure handling.
- `audioData` in the shared chat message contract.
- Backend audio delivery through WebSocket.
- Browser audio playback.

GPT-SoVITS uses:

```text
version: v2Pro
device: cpu
is_half: false

GPT:
  s1v3.ckpt

SoVITS:
  v2Pro/s2Gv2Pro.pth
```

CPU inference keeps GPT-SoVITS from competing with the local llama.cpp model for the limited VRAM of a 4 GB RTX 3050.

---

## Phase 8 — Real-Time Conversation

Extended Ada toward real-time conversational interaction.

- Low-latency conversation flow.
- Continuous conversation state.
- Speech-aware interaction.
- Synchronization between generated speech and avatar state.
- Interruption-aware conversation architecture.

---

## Phase 9 — Tools / Agent

Established a controlled tool and agent architecture.

The tool layer is designed around:

- Explicit tool interfaces.
- Tool allowlists.
- Permission checks.
- User confirmation for sensitive actions.
- Tool execution logging.
- Separation between reasoning and privileged system operations.

Unrestricted shell access is not part of the default assistant architecture.

---

## Phase 10 — Proactive Behavior

Extended Ada beyond purely reactive conversations.

The architecture supports:

- Scheduled behavior.
- Context-aware reminders.
- Proactive notifications.
- User-defined routines.
- Event-driven assistant behavior.

Proactive actions are controlled by explicit application rules rather than unrestricted autonomous execution.

---

## Phase 11 — Vision

Extended Ada toward multimodal interaction.

The architecture supports future visual inputs such as:

- Screenshots.
- Camera frames.
- Image understanding.
- Visual conversation context.
- Vision-assisted tools.

Vision capabilities remain isolated behind provider interfaces so they do not affect the core conversation architecture.

---

## Phase 12 — Polish

Finalized the user experience and system reliability.

- UI refinement.
- Avatar animation refinement.
- Voice quality improvements.
- Conversation responsiveness.
- Error handling.
- Service startup reliability.
- Performance optimization.
- Logging and diagnostics.
- Documentation.
- Maintainability.

The resulting system is a modular local AI VTuber assistant with clear separation between presentation, application logic, AI providers, memory, and external/local model processes.

---

# Architecture

## System Architecture

```mermaid
flowchart TB
    USER([User])

    subgraph FRONTEND["Browser — React + TypeScript + Vite"]
        CHAT["Chat UI"]
        AVATAR["VRM Avatar<br/>Three.js + @pixiv/three-vrm"]
        EXPRESSIONS["Expressions / Animations"]
        AUDIO["Audio Playback"]
    end

    subgraph BACKEND["Ada Backend — Node.js + TypeScript"]
        WS["WebSocket Server"]
        CONV["Conversation Orchestrator"]
        MEMORY["Memory Manager"]
        STRUCT["Structured Response Validation"]
        LLM_PROVIDER["LLMProvider"]
        TTS["TTSService"]
        PRE["TTSPreprocessor"]
        TTS_PROVIDER["TTSProvider"]
    end

    subgraph AI["Local AI Services"]
        LLAMA["llama.cpp<br/>Qwen3-4B Q4_K_M<br/>:8080"]
        GPT["GPT-SoVITS v2Pro<br/>:9880"]
    end

    subgraph STORAGE["Local Storage"]
        SQLITE["SQLite"]
    end

    USER --> CHAT
    CHAT <-->|WebSocket| WS
    WS --> CONV

    CONV --> MEMORY
    MEMORY <--> SQLITE

    CONV --> LLM_PROVIDER
    LLM_PROVIDER --> LLAMA
    LLAMA --> LLM_PROVIDER

    LLM_PROVIDER --> STRUCT

    STRUCT --> CHAT
    STRUCT --> EXPRESSIONS
    EXPRESSIONS --> AVATAR

    STRUCT --> TTS
    TTS --> PRE
    PRE --> TTS_PROVIDER
    TTS_PROVIDER --> GPT
    GPT --> TTS_PROVIDER
    TTS_PROVIDER --> TTS

    TTS -->|audioData| WS
    WS --> AUDIO
```

## Runtime Architecture

```text
                         ┌──────────────────────┐
                         │        USER          │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│                                                              │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────┐  │
│  │   Chat UI    │    │   VRM Avatar  │    │ Audio Player │  │
│  └──────┬───────┘    └───────┬───────┘    └──────▲───────┘  │
│         │                    │                   │          │
└─────────┼────────────────────┼───────────────────┼──────────┘
          │                    │                   │
          │ WebSocket          │ Avatar state      │ audioData
          ▼                    │                   │
┌──────────────────────────────────────────────────────────────┐
│                     ADA BACKEND :3001                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Conversation Orchestrator                │  │
│  └───────┬──────────────────┬───────────────────┬────────┘  │
│          │                  │                   │             │
│          ▼                  ▼                   ▼             │
│   ┌─────────────┐    ┌─────────────┐    ┌──────────────┐    │
│   │   Memory    │    │ LLMProvider │    │  TTSService  │    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬───────┘    │
│          │                   │                  │             │
└──────────┼───────────────────┼──────────────────┼─────────────┘
           │                   │                  │
           ▼                   ▼                  ▼
     ┌───────────┐       ┌────────────┐    ┌──────────────┐
     │  SQLite   │       │ llama.cpp  │    │ GPT-SoVITS   │
     │  Memory   │       │   :8080    │    │ v2Pro :9880  │
     └───────────┘       └────────────┘    └──────────────┘
```

## Service Map

| Service | Address | Purpose |
|---|---|---|
| Ada frontend | Vite-configured port | Browser application |
| Ada backend | `127.0.0.1:3001` | Conversation, WebSocket, and API |
| llama.cpp | `127.0.0.1:8080` | Local LLM inference |
| GPT-SoVITS Main WebUI | `127.0.0.1:9874` | GPT-SoVITS main interface |
| GPT-SoVITS TTS UI | `127.0.0.1:9872` | TTS inference interface |
| GPT-SoVITS API | `127.0.0.1:9880` | Ada TTS provider endpoint |
| SQLite | Local file | Persistent memory |

---

# Repository Structure

```text
ada-project/
├── frontend/
│   ├── public/
│   │   └── models/
│   │       └── ada-vrm-1.0.vrm
│   └── src/
│       ├── avatar/
│       ├── components/
│       ├── index.css
│       └── main.tsx
│
├── backend/
│   └── src/
│       ├── ai/
│       │   ├── providers/
│       │   └── prompts/
│       ├── memory/
│       ├── tts/
│       │   ├── providers/
│       │   └── ...
│       └── server.ts
│
├── shared/
│   └── src/
│       ├── schemas/
│       └── types/
│
├── database/
├── ai-models/
├── external/
│   └── GPT-SoVITS/
├── docs/
│   ├── DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── AGENTS.md
├── .env.example
└── README.md
```

---

# Requirements

The documented environment uses:

- Fedora Linux
- Node.js
- npm
- Conda / Miniconda
- Python 3.10.x
- NVIDIA GPU
- llama.cpp
- GPT-SoVITS v2Pro
- SQLite
- `ffmpeg` / `ffplay` for optional audio testing

The core AI stack is local-first and does not require paid AI APIs.

---

# Running the Project

Run each long-running service in a separate terminal.

The normal runtime consists of:

```text
Terminal 1 → llama.cpp
Terminal 2 → GPT-SoVITS API
Terminal 3 → Ada backend
Terminal 4 → Ada frontend
```

The GPT-SoVITS WebUI is optional and is only needed when manually testing or changing voice/reference settings.

---

## 1. Start llama.cpp

From the Ada repository:

```bash
cd ~/SauravSan/Coding/ada-project/llama.cpp
```

Start the local LLM:

```bash
./build/bin/llama-server \
  -m ../ai-models/qwen3-4b-q4_k_m.gguf \
  -c 4096 \
  -ngl 99 \
  --port 8080
```

Verify the server:

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are Ada, a helpful AI companion."
      },
      {
        "role": "user",
        "content": "Hello Ada, are you online?"
      }
    ],
    "temperature": 0.7
  }'
```

Keep this terminal running.

---

## 2. Start GPT-SoVITS API

Open another terminal:

```bash
conda activate GPTSoVits
```

Go to the GPT-SoVITS installation:

```bash
cd ~/SauravSan/Coding/ada-project/external/GPT-SoVITS
```

Start the v2Pro API:

```bash
python api_v2.py \
  -a 127.0.0.1 \
  -p 9880 \
  -c GPT_SoVITS/configs/ada_v2pro.yaml
```

The expected configuration is:

```text
device              : cpu
is_half             : False
version             : v2Pro
t2s_weights_path    : GPT_SoVITS/pretrained_models/s1v3.ckpt
vits_weights_path   : GPT_SoVITS/pretrained_models/v2Pro/s2Gv2Pro.pth
```

Verify the port:

```bash
ss -ltnp | grep 9880
```

Keep this terminal running.

---

## 3. Start GPT-SoVITS WebUI — Optional

The WebUI is useful for manually testing TTS and reference voices. Ada itself only requires the API on port `9880`.

```bash
conda activate GPTSoVits
cd ~/SauravSan/Coding/ada-project/external/GPT-SoVITS
python webui.py
```

The interfaces are:

```text
Main WebUI:
http://127.0.0.1:9874

TTS inference UI:
http://127.0.0.1:9872
```

---

## 4. Start Ada Backend

Open another terminal:

```bash
cd ~/SauravSan/Coding/ada-project/backend
```

Install dependencies when setting up the project for the first time:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The backend runs on:

```text
http://127.0.0.1:3001
```

Verify it:

```bash
curl http://127.0.0.1:3001/api/health
```

Expected:

```json
{
  "status": "ok",
  "service": "ada-backend"
}
```

Keep this terminal running.

---

## 5. Start Ada Frontend

Open another terminal:

```bash
cd ~/SauravSan/Coding/ada-project/frontend
```

Install dependencies when setting up the project for the first time:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Vite will print the local browser URL. Open that URL in your browser.

---

# Quick Startup Reference

For future use, the normal startup is:

### Terminal 1 — llama.cpp

```bash
cd ~/SauravSan/Coding/ada-project/llama.cpp

./build/bin/llama-server \
  -m ../ai-models/qwen3-4b-q4_k_m.gguf \
  -c 4096 \
  -ngl 99 \
  --port 8080
```

### Terminal 2 — GPT-SoVITS API

```bash
conda activate GPTSoVits
cd ~/SauravSan/Coding/ada-project/external/GPT-SoVITS

python api_v2.py \
  -a 127.0.0.1 \
  -p 9880 \
  -c GPT_SoVITS/configs/ada_v2pro.yaml
```

### Terminal 3 — Ada backend

```bash
cd ~/SauravSan/Coding/ada-project/backend
npm run dev
```

### Terminal 4 — Ada frontend

```bash
cd ~/SauravSan/Coding/ada-project/frontend
npm run dev
```

Then open the URL printed by Vite.

---

# GPT-SoVITS Reference Voice

Ada uses GPT-SoVITS zero-shot voice cloning.

The reference audio used by the API should be:

- Between 3 and 10 seconds.
- A clear recording of a single speaker.
- Free of significant background noise or music.
- Consistent with the supplied prompt transcript.
- Suitable for the language specified by `prompt_lang`.

A direct API request has the following structure:

```bash
curl -s -X POST "http://127.0.0.1:9880/tts" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello Ada, this is a test of your voice.",
    "text_lang": "en",
    "ref_audio_path": "/path/to/reference.wav",
    "prompt_lang": "en",
    "prompt_text": "Your exact reference audio transcript.",
    "text_split_method": "cut5",
    "batch_size": 1,
    "media_type": "wav",
    "streaming_mode": false
  }' \
  --output ada-test.wav
```

Play the generated file with:

```bash
ffplay ada-test.wav
```

---

# Building the Project

Build the backend:

```bash
cd ~/SauravSan/Coding/ada-project/backend
npm run build
```

Build the frontend:

```bash
cd ~/SauravSan/Coding/ada-project/frontend
npm run build
```

Both builds should complete successfully.

---

# Troubleshooting

## GPT-SoVITS API fails to start with missing model weights

Make sure the v2Pro configuration exists:

```bash
cat ~/SauravSan/Coding/ada-project/external/GPT-SoVITS/GPT_SoVITS/configs/ada_v2pro.yaml
```

It should contain:

```yaml
custom:
  device: cpu
  is_half: false
  version: v2Pro
  t2s_weights_path: GPT_SoVITS/pretrained_models/s1v3.ckpt
  vits_weights_path: GPT_SoVITS/pretrained_models/v2Pro/s2Gv2Pro.pth
  bert_base_path: GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large
  cnhuhbert_base_path: GPT_SoVITS/pretrained_models/chinese-hubert-base
```

The v2Pro model files should exist:

```bash
ls -lh ~/SauravSan/Coding/ada-project/external/GPT-SoVITS/GPT_SoVITS/pretrained_models/s1v3.ckpt
ls -lh ~/SauravSan/Coding/ada-project/external/GPT-SoVITS/GPT_SoVITS/pretrained_models/v2Pro/s2Gv2Pro.pth
```

---

## Port 9880 is unavailable

Check:

```bash
ss -ltnp | grep 9880
```

If another GPT-SoVITS API process is already running, stop it before starting another instance.

---

## GPT-SoVITS returns a reference-audio error

If the API reports:

```text
Reference audio is outside the 3-10 second range
```

use a reference recording between 3 and 10 seconds.

Check the duration:

```bash
ffprobe -v error \
  -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 \
  /path/to/reference.wav
```

---

## llama.cpp runs out of VRAM

The local machine uses a 4 GB RTX 3050. GPT-SoVITS is therefore configured for CPU inference.

Avoid changing GPT-SoVITS to CUDA unless enough VRAM is available after llama.cpp has loaded its model.

Check GPU memory:

```bash
nvidia-smi
```

---

## Ada backend is not responding

Check whether the backend is running:

```bash
ss -ltnp | grep 3001
```

Then:

```bash
curl http://127.0.0.1:3001/api/health
```

If dependencies are missing:

```bash
cd ~/SauravSan/Coding/ada-project/backend
npm install
npm run dev
```

---

## Frontend does not start

```bash
cd ~/SauravSan/Coding/ada-project/frontend
npm install
npm run dev
```

If Vite starts successfully, use the URL printed in the terminal.

---

# Useful Service Checks

Check all expected local services:

```bash
ss -ltnp | grep -E '3001|8080|9872|9874|9880'
```

Expected services:

```text
3001 → Ada backend
8080 → llama.cpp
9872 → GPT-SoVITS TTS UI
9874 → GPT-SoVITS Main WebUI
9880 → GPT-SoVITS API
```

Check the backend:

```bash
curl http://127.0.0.1:3001/api/health
```

Check the GPT-SoVITS API port:

```bash
ss -ltnp | grep 9880
```

Check llama.cpp:

```bash
curl http://127.0.0.1:8080/v1/models
```

---

# Stopping the Project

Each service runs in its own terminal.

Press:

```text
Ctrl+C
```

in each terminal to stop:

1. Ada frontend
2. Ada backend
3. GPT-SoVITS API
4. llama.cpp

The GPT-SoVITS WebUI can also be stopped with `Ctrl+C` if it was started.

---

# Development Notes

The project documentation is maintained under `docs/`.

Important documents include:

- `docs/DESIGN.md` — product and UX design decisions.
- `docs/ARCHITECTURE.md` — technical architecture and component relationships.
- `docs/CHANGELOG.md` — implementation history.
- `docs/AGENTS.md` — development rules and constraints.

When making future architectural changes:

1. Read the relevant documentation first.
2. Preserve the provider and subsystem boundaries.
3. Avoid adding infrastructure before it is needed.
4. Test the affected subsystem independently.
5. Update the documentation after implementation.

---

# License

This project is a personal development project.
