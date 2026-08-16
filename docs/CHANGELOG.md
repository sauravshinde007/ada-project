# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 7A: Backend TTS Integration**
  - Added `TTSProvider`, `GPTSoVITSProvider`, `TTSPreprocessor`, and `TTSService`.
  - Connected structured LLM responses to the TTS pipeline without coupling conversation logic directly to GPT-SoVITS.
  - Added `audioData` to the shared `ChatMessage` contract.
  - Added backend-to-frontend delivery of generated audio through the existing WebSocket message flow.
  - Added basic frontend audio autoplay for generated TTS responses.
  - Added dedicated GPT-SoVITS v2Pro API configuration at `GPT_SoVITS/configs/ada_v2pro.yaml`.
  - Configured the GPT-SoVITS API to use `s1v3.ckpt` and `v2Pro/s2Gv2Pro.pth`.
  - Configured the API for CPU inference to avoid exhausting the RTX 3050's limited VRAM while llama.cpp is also used by Ada.

### Verified
- GPT-SoVITS v2Pro API successfully starts on `127.0.0.1:9880`.
- v2Pro Text2Semantic, VITS, BERT, and CNHuBERT models load successfully.
- Direct `/tts` API synthesis succeeds using the Ada reference voice and produces playable WAV audio.
- GPT-SoVITS WebUI remains available on the existing local ports:
  - Main UI: `9874`
  - TTS inference UI: `9872`
- Backend and frontend TypeScript builds pass after the Phase 7A implementation.

### In Progress
- Final manual verification of the complete Ada user-facing flow:
  `LLM → TTS preprocessing → GPT-SoVITS → WebSocket → browser audio`.
- Live verification of TTS preprocessing and graceful TTS-unavailable fallback through the Ada application.

### Known Limitations
- Voice remains zero-shot and uses a reference voice rather than a dedicated trained Ada voice.
- Neutral reference audio can produce relatively flat/read-like delivery.
- Emotion-aware vocal delivery is not implemented.
- Avatar talking state and lip-sync are not implemented.
- TTS currently generates complete audio before delivery; streaming and interruption are not implemented.
- Base64 audio in `ChatMessage.audioData` is a simple Phase 7A transport mechanism and may be replaced by a more efficient streaming/audio transport later.

- **Phase 1: Foundation**
  - Scaffolded frontend using React, TypeScript, and Vite.
  - Set up backend using Node.js, Express, and WebSocket.
  - Created a simple Express health endpoint (`GET /api/health`).
  - Added a minimal chat UI connecting to the backend via WebSocket.
  - Added placeholder backend response for incoming chat messages ("Ada is currently offline...").
  - Established shared types for WebSocket events and Chat messages in `shared/src/types`.

### Fixed & Changed
- **Phase 2: VRM Avatar Fixes**
  - Fixed VRM orientation so Ada faces the camera correctly instead of backwards.
  - Added smooth mouse tracking for Ada's eyes/head using VRM `lookAt` system.
  - Improved avatar camera framing by zooming in to a chest-up portrait view.
  - Replaced the default T-pose with a natural relaxed standing pose (arms down).
  - Added procedural idle animations including subtle breathing (chest expansion/spine pitch) and arm movements.
  - Redesigned frontend UI to a full-screen layout where the avatar fills the background and chat is in a translucent left-side panel.
  - Removed the standalone chat toggle button and instead added an integrated handle to the chat panel, matching the collapsible left-side drawer design.
  - Migrated the Dev Expressions controls into a clean, collapsible left-side drawer (stacked above the chat handle) matching the new UI aesthetics.
  - Improved procedural idle behavior to include complex non-repeating sine wave weight shifts (spine, neck, shoulders, hips) for a natural, living feel.
  - Enhanced the VRM cursor look-at system to feature smooth interpolation, realistic rotational limits, and a subtle idle gaze drift when staring.

### Prepared
- **Phase 3: Local LLM**
  - Prepared the `ai-models/README.md` containing build and deployment instructions for `llama.cpp` on Fedora Linux (NVIDIA CUDA).
  - Selected `Qwen3-4B-Instruct-GGUF` (Q4_K_M) as the designated local model to run within the 4GB VRAM constraint.

### Fixed & Changed
- **Phase 7: Voice / TTS Environment Fixes**
  - Fixed GPT-SoVITS WebUI startup compatibility by pinning Starlette below 1.0 to remain compatible with the installed Gradio 4.x stack.
  - Fixed missing NLTK `cmudict` and English perceptron tagger resources required by `g2p_en`.
  - Added a manual NLTK data installation path under `~/nltk_data` to work around the configured proxy's blocked NLTK downloads.

### Known Limitations
- The current zero-shot voice reproduces speaker identity well but can sound relatively flat when using a neutral reference clip.
- Emotion-aware vocal delivery has not yet been integrated.
- A dedicated Ada voice/reference set has not yet been finalized.
- ALL-CAPS words can be interpreted as individual letters by the English G2P pipeline; TTS text normalization is therefore required before production integration.
- GPT-SoVITS is currently tested through its WebUI only; Ada's backend has not yet been connected to the TTS engine.
- Avatar mouth/lip synchronization with generated speech has not yet been implemented.

## Current Milestone

**Phase 7: Voice / TTS — TTS engine installed and verified; integration and emotion-aware speech are next.**
