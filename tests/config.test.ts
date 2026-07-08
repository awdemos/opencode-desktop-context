import { describe, it, expect } from "bun:test"
import { parseConfig, defaultConfig } from "../src/config"

describe("parseConfig", () => {
  it("uses defaults for empty input", () => {
    const config = parseConfig({})
    expect(config.captureTarget).toBe("fullScreen")
    expect(config.maxAgeMs).toBe(30000)
    expect(config.autoAttach).toBe(true)
    expect(config.systemHint).toBe(false)
    expect(config.visualIndicator).toBe(true)
    expect(config.retention).toBe("temp")
    expect(config.retentionTtlMs).toBe(600000)
    expect(config.blocklist).toContain("1Password")
    expect(config.allowlist).toEqual([])
    expect(config.quality).toBe(80)
  })

  it("parses custom values", () => {
    const config = parseConfig({
      captureTarget: "activeWindow",
      maxAgeMs: 5000,
      autoAttach: false,
      systemHint: true,
      visualIndicator: false,
      retention: "persistent",
      persistentDir: "/tmp/screenshots",
      retentionTtlMs: 1000,
      blocklist: ["SecretApp"],
      allowlist: ["Code"],
      quality: 60,
    })
    expect(config.captureTarget).toBe("activeWindow")
    expect(config.maxAgeMs).toBe(5000)
    expect(config.autoAttach).toBe(false)
    expect(config.systemHint).toBe(true)
    expect(config.visualIndicator).toBe(false)
    expect(config.retention).toBe("persistent")
    expect(config.persistentDir).toBe("/tmp/screenshots")
    expect(config.retentionTtlMs).toBe(1000)
    expect(config.blocklist).toEqual(["SecretApp"])
    expect(config.allowlist).toEqual(["Code"])
    expect(config.quality).toBe(60)
  })

  it("rejects invalid captureTarget", () => {
    expect(() => parseConfig({ captureTarget: "invalid" })).toThrow()
  })

  it("rejects quality out of range", () => {
    expect(() => parseConfig({ quality: 150 })).toThrow()
  })

  it("requires persistentDir when retention is persistent", () => {
    expect(() => parseConfig({ retention: "persistent" })).toThrow()
  })
})
