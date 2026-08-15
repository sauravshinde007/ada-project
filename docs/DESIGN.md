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

## Avatar Behavior

The avatar should have:

- idle breathing
- blinking
- eye movement
- subtle head movement
- facial expressions
- emotion animations
- talking/mouth movement when voice is added

Avoid excessive animation. The character should feel alive, not like a constant GIF.

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
