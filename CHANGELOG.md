# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Fixed Step 6C Memory Bug: Upgraded explicit "forget" commands to use an LLM-based semantic matching resolution instead of strict SQLite LIKE matching. Ada can now intelligently resolve spelling variants (favorite/favourite), spacing (onepiece/One Piece), and perspective differences, and will ask for clarification if multiple memories match the forget request.
- Implemented Step 6C: Explicit Memory Control.
- Added support for explicit commands: "remember that...", "forget that...", and "what do you remember about me".
- Added a new `source` column to the `memories` SQLite table to distinguish between `explicit` and `inferred` memories.
- Intercepted explicit commands in `MemoryManager` to instantly mutate the memory database and inject prompt context, bypassing the background extraction delay and confirming actions naturally to the user.
- Fixed Step 6B Memory Bug: Resolved an issue where keyword extraction used literal backslash string escapes (`/\\s+/`) resulting in failed memory retrieval matches.
- Fixed Step 6B Memory Bug: Stripped punctuation during memory keyword matching so queries like "name?" successfully hit the database.
- Added debug logging across the Memory pipeline to track extraction, keyword search, retrieval, and prompt injection.
- Implemented Step 6B: Automatic Memory Extraction and Retrieval.
- Created `MemoryManager.ts` which performs a background zero-shot LLM call after user messages to classify and extract durable facts, preferences, and goals into structured JSON.
- Prevented duplicates, questions, greetings, and temporary statements from being extracted to memory.
- Intercepted LLM context generation to inject a `[System Note]` with retrieved relevant memories via a keyword search against the SQLite database, without polluting the ongoing chat history.
- Implemented Step 6A: Memory Foundation.
- Added a local SQLite database (`ada_memory.sqlite`) using `better-sqlite3`.
- Created `MemoryService` abstraction to handle `conversations`, `messages`, and `memories`.
- The backend now automatically stores chat messages in SQLite persistently.
- Created `MemoryService.test.ts` to validate DB interactions, memory creation, search, and deletion.
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
