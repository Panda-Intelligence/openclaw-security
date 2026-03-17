# LLM Runtime Security Checklist for OpenClaw

The most important **OpenClaw security** issues often appear after installation. Once models can call tools, load skills, and retain memory, the runtime becomes the real audit boundary.

## Core LLM audit questions

### 1. Can prompts leak secrets?

Review system prompts, long-term memory, and report exports for credentials, tokens, and internal instructions.

### 2. Can tools overreach?

Map every tool or skill to the actions it can take. If a model can trigger shell, browser, or network actions, the approval model matters.

### 3. Can provider routing drift?

Fallback or provider sync changes can silently alter where requests go and which security assumptions still hold.

### 4. Can untrusted content shape behavior?

Prompt injection does not need a browser to be dangerous. It can enter through stored memory, imported docs, or public content consumed by agents.

## How to operationalize it

- Track prompt exposure and memory injection as recurring scan categories.
- Tie tool permissions to explicit operator review.
- Re-check the model path every time dependencies, providers, or runtime defaults change.

This is why OpenClaw Security treats **LLM runtime safety** as part of the audit surface, not a separate research topic.
