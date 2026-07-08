# opencode-desktop-context

OpenCode plugin that captures desktop screenshots and adds them to the active session context.

## Installation

Add to your `opencode.json`:

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

- Auto-attach latest screenshot to every user message.
- On-demand `capture_desktop` tool.
- Configurable blocklist/allowlist.
- Cross-platform: macOS, Windows, Linux.
