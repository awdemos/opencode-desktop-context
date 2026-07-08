# OpenCode Desktop Context Plugin — Design Spec

**Date:** 2026-07-08  
**Status:** Approved for implementation  
**Plugin name:** `opencode-desktop-context`

## 1. Overview & Goals

`opencode-desktop-context` is a standalone OpenCode plugin that periodically captures the user's desktop and injects the latest screenshot into the active OpenCode session as context. Screenshots may contain sensitive information and are sent to the configured model provider; prefer local models whenever possible.

### Core behaviors

1. **Auto-capture:** On every user message, capture or reuse a fresh-enough screenshot and attach it to the message.
2. **On-demand tool:** Expose a `capture_desktop` tool the model can call when it explicitly needs to see the screen.
3. **Privacy-first:** User permission prompt, configurable blocklist/allowlist, optional visual indicator, and configurable retention.
4. **Cross-platform:** Native adapters for macOS, Windows, and Linux.

### Out of scope for v1

- Visual diffing / smart deduplication (designed to be added later).
- OCR or annotation of screenshots.
- Video recording or long-term screen history beyond the latest capture.

## 2. Architecture & File Structure

```
opencode-desktop-context/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                    # Main plugin entrypoint
│   ├── config.ts                   # Option schema + defaults
│   ├── capture/
│   │   ├── index.ts                # Capture orchestrator
│   │   ├── types.ts                # Shared capture types
│   │   ├── macos.ts                # macOS adapter
│   │   ├── windows.ts              # Windows adapter
│   │   └── linux.ts                # Linux adapter (Wayland/X11 fallbacks)
│   ├── privacy/
│   │   ├── index.ts                # Blocklist/allowlist matching
│   │   └── permission.ts           # First-run permission prompt
│   ├── tools/
│   │   └── capture-desktop.ts      # `capture_desktop` tool definition
│   └── hooks/
│       ├── chat-message.ts         # Auto-attach screenshot to user message
│       └── system-hint.ts          # Optional system prompt hint injection
```

### Design choices

- **Adapters implement a common interface:** `capture(target) => Promise<CaptureResult>`.
- **Capture orchestrator** decides whether to capture, which adapter to call, whether the active window is blocked, and where to store the result.
- **No TUI dependency** in v1 — logging uses the OpenCode SDK client.

## 3. Configuration

Users configure the plugin in `opencode.json`:

```json
{
  "plugin": [
    ["opencode-desktop-context", {
      "captureTarget": "fullScreen",
      "maxAgeMs": 30000,
      "autoAttach": true,
      "systemHint": false,
      "visualIndicator": true,
      "retention": "temp",
      "retentionTtlMs": 600000,
      "blocklist": ["1Password", "Bitwarden", "Chase", "Keychain Access"],
      "allowlist": [],
      "quality": 80
    }]
  ]
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `captureTarget` | `"fullScreen" \| "activeWindow" \| "allDisplays"` | `"fullScreen"` | What to capture. |
| `maxAgeMs` | `number` | `30000` | Reuse a cached screenshot if newer than this. |
| `autoAttach` | `boolean` | `true` | Attach latest screenshot to every user message. |
| `systemHint` | `boolean` | `false` | Inject a hint telling the model about `capture_desktop`. |
| `visualIndicator` | `boolean` | `true` | Show a brief indicator when a screenshot is taken. |
| `retention` | `"memory" \| "temp" \| "persistent"` | `"temp"` | Where screenshots live. |
| `retentionTtlMs` | `number` | `600000` | For `temp`, delete files older than this. |
| `persistentDir` | `string \| null` | `null` | Required when `retention` is `"persistent"`. |
| `blocklist` | `string[]` | `["1Password", "Bitwarden", ...]` | Window/app titles or names to never capture. |
| `allowlist` | `string[]` | `[]` | If non-empty, only capture when active window matches. |
| `quality` | `number` | `80` | JPEG quality for attachments (PNG if `100`). |

## 4. Data Flow

### Auto-capture on user message

1. `chat.message` hook fires.
2. Capture orchestrator checks:
   - Has the user granted permission? If not, prompt once and skip.
   - Is `autoAttach` enabled?
   - Is there a cached screenshot newer than `maxAgeMs`?
3. If a fresh capture is needed:
   - Determine active window/app name (for blocklist/allowlist).
   - If blocked, log and skip.
   - Call the platform adapter to capture according to `captureTarget`.
   - Encode to JPEG/PNG based on `quality`.
   - Store according to `retention` policy.
4. Attach the screenshot as a `FilePart` with `type: "file"`, `mime: "image/png"` or `"image/jpeg"`, and a URL pointing to the stored image.

### On-demand capture

1. Model calls `capture_desktop`.
2. Tool bypasses the cache and captures immediately.
3. Returns the image as a tool result `attachment` with `type: "file"`, matching `mime` and `url`.

### Retention policies

- **memory:** Keep only the latest screenshot in a Buffer. If the SDK requires a file path, write temporarily and delete synchronously after attachment.
- **temp:** Write to `~/Pictures/opencode-desktop-context/` with `retentionTtlMs` TTL, cleaned up at session end and on plugin startup.
- **persistent:** Write to `persistentDir`. User is responsible for cleanup.

## 5. Privacy Controls

### Permission prompt

On first capture attempt, ask the user for consent via OpenCode's permission/ask mechanism or a one-time log + `ask` tool. Persist the grant in a small config file in the OpenCode config directory.

### Blocklist / allowlist

- Match against active window title and application/process name (case-insensitive substring).
- If `allowlist` is non-empty, capture only when the active window matches an allowlist entry.
- If `blocklist` matches, skip capture and log at debug level.

### Visual indicator

When `visualIndicator` is true, emit a short TUI toast via `tui.toast.show` or a brief console log if TUI is unavailable. This is configurable so users can disable it.

## 6. Platform Adapters

### macOS

- Primary: `screencapture` CLI.
- Active window: `screencapture -w` requires window ID; use `osascript` or `screencapture -l` if available.
- Active app/title: `osascript` to query frontmost application.

### Windows

- Primary: PowerShell script using .NET `System.Drawing.Graphics.CopyFromScreen`.
- Alternative: `screenshot-desktop` package as a fallback if native tooling fails.
- Active window: `Get-ForegroundWindow` via PowerShell.

### Linux

- Wayland: `grim` for full screen, `grim -g` with `slurp` for region/window. Active window via `hyprctl activewindow`, `swaymsg`, or `niri` CLI depending on compositor.
- X11: `import` from ImageMagick or `ffmpeg -f x11grab`.
- Active app/title: `xprop` on X11; compositor-specific tools on Wayland.
- Fallback order: `grim` → `import` → `ffmpeg` → error.

## 7. Error Handling

- **Permission denied:** Log a clear message with instructions to grant screen recording permission and disable capture until granted.
- **No active window / unknown compositor (Linux):** Log at debug and fall back to full-screen capture if `captureTarget` is `activeWindow`.
- **Adapter failure:** Try fallback mechanisms within the same OS, then return a tool error for on-demand captures or skip for auto-capture.
- **Blocklist match:** Silent skip; do not error.
- **Retention cleanup failure:** Log warning; do not crash.

## 8. Testing Strategy

- **Unit tests** for config parsing, blocklist matching, and retention cleanup.
- **Adapter mock tests** ensure each adapter returns a valid image buffer and respects `captureTarget`.
- **Integration test** runs the plugin in a headless OpenCode session (if feasible) and verifies a `capture_desktop` tool call returns an attachment.
- **Manual test matrix:** macOS, Windows, and at least one Linux distro (Wayland and X11).

## 9. Future Work

- Visual diffing / perceptual hashing to avoid redundant screenshots.
- OCR layer to provide searchable text from screenshots.
- Video/gif capture for short screen recordings.
- Window/application-specific capture targets by title.
