# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Implemented Step 5B: Connected Ada's Emotion System to her VRM Avatar. 
- Mapped LLM emotion types to actual available VRM expressions (e.g. `excited` -> `happy`, `embarrassed` -> `sad`).
- Added smooth linear interpolation (lerping) in `AvatarController.ts` so facial expressions transition naturally over time instead of instantly snapping.
- Fixed prompt hallucination issues: Added explicit rules forbidding Ada from inventing recurring fictional lore (e.g., the "virtual closet") and forcing her to drop previous topics when the subject changes.
- Implemented Step 5: Emotion System.
- Created `shared/src/schemas/emotion.ts` to type and validate structured JSON responses from the LLM.
- Updated LLM system prompt to enforce structured JSON output containing `text`, `emotion`, `intensity`, and `animation`.
- Updated backend to parse and gracefully fallback on invalid JSON LLM responses before sending them over WebSockets.
- Updated frontend `VRMAvatar` to automatically react to incoming emotion and intensity data from Ada's chat responses.
- Refined Ada's personality prompt to enforce short, natural responses (1-3 sentences) and strictly ban text-based stage directions (e.g., "*smiles*").
- Implemented Step 4: Configurable Ada Personality (anime-style tsundere).
- Created a separate `SystemPrompt.ts` file to keep personality separated from the LLM provider.
- Updated `server.ts` to utilize the new personality prompt for all incoming chat sessions.
- Documented new personality traits in `DESIGN.md`.
- Added LLMProvider abstraction and local LlamaCppProvider implementation (Phase 3D).
- Connected the Node.js backend to the local llama.cpp server for processing chat messages.
