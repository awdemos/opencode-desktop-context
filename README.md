# opencode-desktop-context

OpenCode plugin that captures desktop screenshots and adds them to the active session context.

## Installation

Install the plugin from npm and add it to your `opencode.json`:

```bash
npm install opencode-desktop-context
```

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

## Features

- **Auto-attach:** Adds the latest desktop screenshot to every user message.
- **On-demand tool:** Exposes `capture_desktop` for the model to request a fresh screenshot.
- **Privacy controls:** Permission persistence, blocklist/allowlist, configurable retention, and optional capture indicator.
- **Cross-platform:** Native capture adapters for macOS, Windows, and Linux.

## Configuration

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

## Platform Requirements

- **macOS:** `screencapture` (built-in)
- **Windows:** PowerShell with .NET (built-in)
- **Linux:** One of `grim` (Wayland), `import` from ImageMagick, or `ffmpeg` (X11)

## Privacy

The first time `capture_desktop` is called, the plugin records a permission grant in `~/.config/opencode/desktop-context-permission.json`. You can revoke permission by deleting that file. The blocklist is checked against the active window title and application name before every capture.

## Development

```bash
bun install
bun test
bun run build
```

## License

MIT
