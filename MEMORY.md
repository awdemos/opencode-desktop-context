# Memory: opencode-desktop-context part IDs

## Problem

When `opencode-desktop-context` pushes a screenshot `Part` onto `output.parts` in `src/hooks/chat-message.ts`, the part `id` must start with `prt-`. OpenCode's server schema rejects any other prefix, causing message saves to fail with a validation error and the prompt to never be sent:

```
SchemaError: Expected a string starting with "prt", got "desktop-1783534333230"
  at ["id"]
POST http://opencode.internal/session/.../message → 400
```

## Rule

Always generate desktop-context part IDs with the `prt-` prefix:

```ts
// src/hooks/chat-message.ts
output.parts.push({
  id: `prt-desktop-${capture.capturedAt}`,
  sessionID: input.sessionID,
  messageID: output.message.id,
  type: "file",
  mime: capture.format === "png" ? "image/png" : "image/jpeg",
  url,
  filename: `desktop-${capture.capturedAt}.${capture.format}`,
})
```

Never use bare `desktop-${capture.capturedAt}` for the `id`.

## Regression test

`tests/chat-message.test.ts` asserts that every generated part `id` matches `/^prt-/`. If that test fails, the plugin will break OpenCode message sending.

## Related files

- `src/hooks/chat-message.ts` — where parts are created
- `tests/chat-message.test.ts` — regression coverage
