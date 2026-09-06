# Agent Notes: opencode-desktop-context

OpenCode plugin that captures desktop screenshots and adds them to the session context. Written in TypeScript, packaged for npm/Bun, and distributed with a Dagger module.

## Repository Layout

- `src/index.ts` — Plugin entrypoint.
- `src/config.ts` — Configuration schema and defaults.
- `src/storage.ts` — Screenshot persistence helpers.
- `src/vision.ts` — Vision-model integration (Ollama / moondream).
- `src/capture/` — OS-specific screenshot backends (Linux, macOS, Windows) and shell fallback.
- `src/hooks/` — OpenCode hooks: `chat-message.ts`, `system-hint.ts`.
- `src/privacy/` — Permission and privacy controls.
- `src/tools/` — Exposed tools: `capture-desktop`, `describe-desktop`.
- `dagger/` — Dagger module for build/publish.
- `tests/` — Regression tests, including the critical `prt-` part-id check.
- `MEMORY.md` — Project-specific memory: part IDs must start with `prt-`.

## Development Setup

Requires Bun (or Node + npm). Install dependencies:

```bash
bun install
```

## Build

```bash
bun run build       # tsc compile to dist/
bun run typecheck   # tsc --noEmit
```

## Test

```bash
bun test
```

The test suite includes a regression test that asserts all generated desktop-context part IDs match `/^prt-/`. If this fails, OpenCode message saving breaks with a schema validation error.

## Dagger / Publish

```bash
# List functions
dagger call --help -m ./

# Publish to npm (requires NPM_TOKEN)
export NPM_TOKEN="your-npm-token"
dagger call -m ./ publish
```

## Key Conventions

- Screenshot part IDs must use the `prt-` prefix (see `MEMORY.md`).
- Capture backends are selected by OS; the shell fallback runs `grim`/`screencapture`/`nircmd` as needed.
- The plugin depends on `sharp` for image resizing/formatting and `zod` for config validation.

## Common Issues

- **`SchemaError: Expected a string starting with "prt"`**: a part id was generated without the `prt-` prefix; fix in `src/hooks/chat-message.ts` and update `tests/chat-message.test.ts`.
- **`bun test` fails on capture**: some tests mock the OS backends; missing mocks may mean a new platform path needs a test fixture.
- **Type errors after plugin SDK bump**: update `@opencode-ai/plugin` peer range and run `bun run typecheck`.

## License

MIT. See `LICENSE`.
