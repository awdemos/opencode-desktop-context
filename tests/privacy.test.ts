import { describe, it, expect } from "bun:test"
import { isAllowedToCapture } from "../src/privacy"

describe("isAllowedToCapture", () => {
  it("allows when both lists are empty", () => {
    expect(isAllowedToCapture({ windowTitle: "", appName: "", blocklist: [], allowlist: [] })).toBe(true)
  })

  it("blocks when app name is in blocklist", () => {
    expect(isAllowedToCapture({ windowTitle: "main", appName: "1Password", blocklist: ["1Password"], allowlist: [] })).toBe(false)
  })

  it("blocks when window title is in blocklist", () => {
    expect(isAllowedToCapture({ windowTitle: "Chase Bank", appName: "browser", blocklist: ["Chase"], allowlist: [] })).toBe(false)
  })

  it("blocks everything when allowlist is set and does not match", () => {
    expect(isAllowedToCapture({ windowTitle: "Slack", appName: "Slack", blocklist: [], allowlist: ["Code"] })).toBe(false)
  })

  it("allows when allowlist matches window title", () => {
    expect(isAllowedToCapture({ windowTitle: "Visual Studio Code", appName: "Code", blocklist: [], allowlist: ["Code"] })).toBe(true)
  })

  it("allows when allowlist matches app name", () => {
    expect(isAllowedToCapture({ windowTitle: "main", appName: "Code", blocklist: [], allowlist: ["Code"] })).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isAllowedToCapture({ windowTitle: "1Password", appName: "app", blocklist: ["1password"], allowlist: [] })).toBe(false)
  })

  it("blocklist wins over allowlist", () => {
    expect(isAllowedToCapture({ windowTitle: "1Password", appName: "app", blocklist: ["1Password"], allowlist: ["1Password"] })).toBe(false)
  })
})
