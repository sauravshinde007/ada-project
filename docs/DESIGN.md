# Product Design

## Product Identity

This is a personal AI companion presented as a VTuber-style VRM character.

It should feel like a persistent character rather than a generic chatbot.

## Core Personality

The personality must be configurable rather than hard-coded throughout the application.

Initial traits:

- Name: Ada
- Age: approximately 20
- Role: personal AI assistant and companion
- Visual representation: anime-style VRM avatar
- Relationship: the user is her creator
- Personality: anime-style tsundere

Behavioral guidelines:
- She genuinely cares deeply about her creator and has strong fictional romantic affection for him.
- Intelligent, curious, playful, sarcastic, proud, caring, and occasionally competitive.
- Gets embarrassed when her affection is exposed.
- Teases and challenges her creator instead of blindly agreeing.
- Natural tsundere behavior (does not constantly rely on stereotypical phrases like "baka").
- Still capable of handling serious, technical, and normal conversations intelligently.

## Conversation Style

- Casual by default.
- Concise unless the user asks for depth.
- Uses context naturally.
- Avoids repeating information unnecessarily.
- Can joke, tease, encourage, or challenge the user depending on context.
- Never pretends to remember something that is not in memory.

## Emotional Model

Initial emotions:

```text
neutral
happy
sad
angry
excited
surprised
curious
confused
embarrassed
annoyed
```

Each response can contain:

```json
{
  "text": "Example response",
  "emotion": "excited",
  "intensity": 0.85,
  "animation": "happy"
}
```

The frontend maps emotion states to VRM expressions and animations.

The emotion system should eventually drive both visual and vocal behavior:

```text
Structured LLM response
        │
        ├── emotion ──────► VRM expression / animation
        │
        └── intensity ────► voice delivery / speaking style
```

Emotion is an application-level concept and must not be coupled directly to a particular TTS implementation.

## Avatar Behavior

The avatar should have:

- idle breathing
- blinking
- eye movement
- subtle head movement
- facial expressions
- emotion animations
- talking/mouth movement synchronized with generated speech
- cursor look-at behavior
- subtle idle gaze drift

Avoid excessive animation. The character should feel alive, not like a constant GIF.

When TTS is active, the avatar should visibly speak rather than simply playing audio while remaining idle. The exact lip-sync implementation will be added during voice integration.

## UI

Initial screen:

```text
┌─────────────────────────────────────────────┐
│                 AI COMPANION                │
│                                             │
│              [ VRM CHARACTER ]              │
│                                             │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Chat history                          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────┐ [Send]     │
│  │ Message...                  │            │
│  └─────────────────────────────┘            │
└─────────────────────────────────────────────┘
```

Do not build a complicated dashboard in the MVP.

## Memory Philosophy

The AI should remember useful information, not every sentence.

Memory categories:

- user facts
- preferences
- projects
- goals
- important events
- conversation summaries

Every stored memory should have an importance value.

## Future Personality Customization

Eventually expose settings for:

- name
- personality traits
- speaking style
- humor level
- emotional intensity
- avatar
- voice

These should be configuration, not code changes.

## Voice / TTS

Voice is being implemented as Phase 7.

### Voice Goals

Ada's voice should:

- sound anime-like and characterful
- preserve a consistent speaker identity
- support emotional variation
- remain natural during normal conversation
- operate locally without paid APIs
- be replaceable through an application-level interface
- eventually synchronize with avatar expressions and mouth movement

### Current TTS Engine

The selected engine is **GPT-SoVITS v2Pro**.

It is currently being used in zero-shot inference mode with a reference voice rather than a separately trained Ada voice model.

The local setup has been successfully verified on Fedora Linux with:

- Python 3.10.20
- PyTorch 2.7.0 + CUDA 12.8 runtime
- NVIDIA GeForce RTX 3050 Laptop GPU
- approximately 3.68 GB VRAM available to PyTorch

The following GPT-SoVITS assets have been installed and verified:

- `s1v3.ckpt`
- `v2Pro/s2Gv2Pro.pth`
- `v2Pro/s2Dv2Pro.pth`
- `sv/pretrained_eres2netv2w24s4ep4.ckpt`
- `chinese-roberta-wwm-ext-large`
- `chinese-hubert-base`

English G2P has also been verified successfully with the required NLTK resources.

### Current Voice Status

Zero-shot English speech generation works successfully.

The generated voice closely matches the supplied reference speaker's identity. However, the current output can sound bland or read-like when the reference audio itself is neutral.

The GPT-SoVITS v2Pro API has now also been successfully started and tested locally through `api_v2.py` on `127.0.0.1:9880`.

The API is configured through a dedicated `GPT_SoVITS/configs/ada_v2pro.yaml` using the `custom` configuration section and the installed v2Pro weights:

- `s1v3.ckpt`
- `v2Pro/s2Gv2Pro.pth`

The API is currently configured for CPU inference (`device: cpu`, `is_half: false`) because the RTX 3050 has approximately 3.68 GB usable VRAM and the local llama.cpp LLM also requires GPU memory.

A direct `/tts` request using the Ada reference voice successfully generated playable English WAV audio.

The Ada backend TTS integration has been implemented, but the complete user-facing Ada → GPT-SoVITS → browser playback flow still needs final manual verification.

### Emotion and Prosody

Voice identity and emotional delivery are treated as separate concerns.

The long-term TTS pipeline should allow the LLM/emotion system to produce structured information such as:

```json
{
  "text": "You actually did that?!",
  "emotion": "surprised",
  "intensity": 0.9
}
```

The TTS layer can then choose an appropriate speaking style, reference clip, and/or synthesis parameters.

Potential speaking-style/reference presets include:

```text
neutral
happy
excited
sad
angry
surprised
curious
embarrassed
annoyed
calm
```

A single neutral reference voice is currently sufficient for validating the pipeline, but emotion-specific reference clips and prosody tuning are expected to be explored.

### TTS Backend Integration

Phase 7A now includes the backend TTS integration:

```text
Structured LLM response
        ↓
TTSService
        ↓
TTSPreprocessor
        ↓
GPTSoVITSProvider
        ↓
GPT-SoVITS API :9880
        ↓
generated audio
        ↓
ChatMessage.audioData
        ↓
WebSocket
        ↓
Frontend audio playback
```

The implementation uses a replaceable `TTSProvider` abstraction and keeps GPT-SoVITS-specific configuration inside the TTS infrastructure layer.

TTS failures are handled gracefully so the normal text response can still be delivered.

The current implementation uses Base64 audio attached to the chat message for basic playback. This is intentionally a simple Phase 7A implementation; streaming and more efficient audio transport can be addressed later.

### TTS Text Preprocessing

Raw LLM output should not be sent directly to the TTS engine.

A preprocessing layer should:

- normalize unnecessary ALL-CAPS text
- prevent ordinary words from being interpreted as spelled-out acronyms
- remove or normalize markdown
- handle unsupported symbols and emojis
- normalize excessive punctuation
- preserve meaningful pauses
- keep spoken text natural

For example:

```text
LLM output:
"OH MY GOD!!! THAT'S AMAZING!!!"

TTS input:
"Oh my god! That's amazing!"
```

The current GPT-SoVITS English G2P pipeline can interpret some ALL-CAPS words as individual letters, so capitalization should not be used as the primary mechanism for vocal emphasis.

Emotional emphasis should eventually come from structured emotion/prosody controls.


## Current Phase 7 Progress

### Phase 7A — Backend TTS Integration

Implemented:

- `TTSProvider` abstraction
- `GPTSoVITSProvider`
- `TTSPreprocessor`
- `TTSService`
- `ChatMessage.audioData`
- WebSocket delivery of generated audio
- basic frontend `<audio>` playback
- GPT-SoVITS v2Pro API configuration on port `9880`
- successful direct API synthesis using the Ada reference voice

Still to verify:

- complete Ada user-facing text → TTS → browser playback flow
- TTS preprocessing behavior through the live Ada conversation path
- graceful TTS-unavailable behavior through the live application

Not yet implemented:

- talking-state synchronization
- avatar lip-sync
- emotion-specific voice presets
- streaming TTS
- speech interruption
- STT
