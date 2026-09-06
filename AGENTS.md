# opencode-desktop-context Agent Guide

**Project:** OpenCode plugin that captures desktop screenshots and adds them to the session context
**Language:** TypeScript
**Runtime:** Bun / Node.js (ESM)
**License:** MIT

## Overview

This plugin lets OpenCode agents request desktop screenshots during a session.
It supports multiple capture adapters, privacy checks, vision-model description,
and secure local storage.

## Repository Layout

- `src/index.ts` — Plugin entrypoint.
- `src/config.ts` — Configuration schema and defaults (zod-validated).
- `src/storage.ts` — Screenshot persistence helpers.
- `src/vision.ts` — Vision-model integration (Ollama / Moondream).
- `src/capture/` — OS-specific screenshot backends (Linux, macOS, Windows) and shell fallback.
- `src/hooks/` — OpenCode hooks: `chat-message.ts`, `system-hint.ts`.
- `src/privacy/` — Permission and privacy controls.
- `src/tools/` — Exposed tools: `capture-desktop`, `describe-desktop`.
- `dagger/` — Dagger module for build/publish.
- `tests/` — Regression tests, including the critical `prt-` part-id check.
- `MEMORY.md` — Project-specific memory: part IDs must start with `prt-`.

## Build Commands

```bash
bun install         # Install dependencies
bun run build       # tsc compile to dist/
bun run typecheck   # tsc --noEmit
```

## Test Commands

```bash
bun test
```

The test suite includes a regression test that asserts all generated
desktop-context part IDs match `/^prt-/`. If this fails, OpenCode message
saving breaks with a schema validation error.

## Lint / Format

No explicit linter configured; rely on `tsc --noEmit` and consistent style.

## Dagger / Publish

```bash
# List functions
dagger call --help -m ./

# Publish to npm (requires NPM_TOKEN)
export NPM_TOKEN="your-npm-token"
dagger call -m ./ publish
```

## Key Conventions

- ESM module (`"type": "module"`).
- Peer dependency on `@opencode-ai/plugin >= 1.14.0`.
- Screenshot part IDs must use the `prt-` prefix (see `MEMORY.md`).
- Capture backends are selected by OS; the shell fallback runs `grim`/`screencapture`/`nircmd` as needed.
- The plugin depends on `sharp` for image resizing/formatting and `zod` for config validation.
- Privacy blocking is checked before every capture.
- Vision description uses a configurable base URL (e.g., Ollama + Moondream).

## Common Issues

- **`SchemaError: Expected a string starting with "prt"`**: a part id was
  generated without the `prt-` prefix; fix in `src/hooks/chat-message.ts` and
  update `tests/chat-message.test.ts`.
- **`bun test` fails on capture**: some tests mock the OS backends; missing
  mocks may mean a new platform path needs a test fixture.
- **Type errors after plugin SDK bump**: update the `@opencode-ai/plugin`
  peer range and run `bun run typecheck`.

## Gotchas

- Screenshot capability depends on the host desktop environment; headless
  servers may need a virtual framebuffer.
- The plugin must be installed into OpenCode's plugin list to be active.
- `prepublishOnly` runs `bun run build`; ensure `dist/` is generated before
  publishing.

## License

MIT. See `LICENSE`.
