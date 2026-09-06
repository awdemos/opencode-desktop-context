# opencode-desktop-context Agent Guide

**Project:** OpenCode plugin for capturing desktop screenshots as session context
**Language:** TypeScript
**Runtime:** Bun / Node.js (ESM)
**License:** MIT

## Overview

This plugin lets OpenCode agents request desktop screenshots during a session.
It supports multiple capture adapters, privacy checks, vision-model description,
and secure local storage.

## Repository Layout

| Path | Purpose |
|------|---------|
| `src/` | Plugin source |
| `src/capture/` | Screenshot capture adapters |
| `src/config.ts` | Configuration loading |
| `src/hooks/` | OpenCode lifecycle hooks |
| `src/privacy/` | Permission / privacy controls |
| `src/storage.ts` | Local image storage |
| `src/tools/` | OpenCode tool definitions |
| `src/vision.ts` | Vision-model client |
| `tests/` | Bun test suite |
| `dagger/` | Dagger module source |
| `package.json` | Scripts and dependencies |
| `tsconfig.json` | TypeScript config |
| `dagger.json` | Dagger module metadata |

## Build Commands

```bash
# Install dependencies
bun install

# TypeScript type check
bun run typecheck

# Build distribution
bun run build
```

## Test Commands

```bash
bun test
```

## Lint / Format

No explicit linter configured; rely on `tsc --noEmit` and consistent style.

## Dagger

```bash
# List functions
dagger call --help -m ./

# Publish via Dagger (requires token env vars)
dagger call -m ./ publish
```

## Key Conventions

- ESM module (`"type": "module"`).
- Peer dependency on `@opencode-ai/plugin >= 1.14.0`.
- Privacy blocking is checked before every capture.
- Vision description uses a configurable base URL (e.g., Ollama + Moondream).

## Gotchas

- Screenshot capability depends on the host desktop environment; headless
  servers may need a virtual framebuffer.
- The plugin must be installed into OpenCode's plugin list to be active.
- `prepublishOnly` runs `bun run build`; ensure `dist/` is generated before
  publishing.
