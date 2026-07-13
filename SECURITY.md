# Security Policy

## Supported Versions

Only the latest release of `opencode-desktop-context` receives security updates. Because this plugin is under active development, users should upgrade to the most recent published version as soon as possible.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities privately by emailing the repository maintainers or opening a confidential issue. Include:

- A description of the vulnerability
- Steps to reproduce
- The version of the plugin and platform you are using
- Any suggested mitigation or fix

We aim to acknowledge reports within 72 hours and release a fix within 14 days for critical issues.

## Security Practices

- **User consent:** Screen capture never occurs without explicit user permission. The plugin prompts through OpenCode's permission mechanism and persists the grant in a file with restricted permissions (`0o600`).
- **Local-first vision:** By default, `ollamaBaseUrl` must point to a loopback address (`localhost`, `127.0.0.1`, or `::1`). Sending screenshots to remote endpoints requires setting `allowRemoteVision: true`.
- **Path containment:** `persistentDir` is validated to be an absolute path within the user's home directory without `..` segments.
- **Private temp directories:** Temporary capture files are written to per-capture directories created with `fs.mkdtemp()` under `os.tmpdir()` and deleted immediately after reading.
- **Shell hardening:** The shell helper uses array-based `spawn()` without shell interpolation and always quotes values.
- **Rate limiting:** The `capture_desktop` tool enforces a cooldown between forced captures.
- **Pinned CI images:** Dagger pipelines use a SHA256-pinned base image and a pinned npm version.

## Audit History

- **2026-07-12:** External security audit identified P0/P1/P2 issues around permission auto-grant, SSRF via `ollamaBaseUrl`, path traversal, predictable `/tmp` paths, shell injection, and CI supply-chain mutability. All findings were remediated in the same release cycle.
