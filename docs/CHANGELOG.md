# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
