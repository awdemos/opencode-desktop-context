import { describe, it, expect } from "bun:test"
import { parseConfig, defaultConfig } from "../src/config"
import { homedir } from "node:os"
import { join } from "node:path"

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
    expect(config.periodicCaptureMs).toBe(300000)
    expect(config.allowRemoteVision).toBe(false)
    expect(config.captureCooldownMs).toBe(1000)
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
      persistentDir: join(homedir(), "screenshots"),
      retentionTtlMs: 1000,
      periodicCaptureMs: 60000,
      allowRemoteVision: true,
      captureCooldownMs: 2000,
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
    expect(config.persistentDir).toBe(join(homedir(), "screenshots"))
    expect(config.retentionTtlMs).toBe(1000)
    expect(config.periodicCaptureMs).toBe(60000)
    expect(config.allowRemoteVision).toBe(true)
    expect(config.captureCooldownMs).toBe(2000)
    expect(config.ollamaBaseUrl).toBe("http://127.0.0.1:11434")
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

  it("rejects negative periodicCaptureMs", () => {
    expect(() => parseConfig({ periodicCaptureMs: -1 })).toThrow()
  })

  it("accepts visionModel and custom ollamaBaseUrl", () => {
    const config = parseConfig({
      visionModel: "moondream:latest",
      ollamaBaseUrl: "http://localhost:11434",
    })
    expect(config.visionModel).toBe("moondream:latest")
    expect(config.ollamaBaseUrl).toBe("http://localhost:11434")
  })

  it("rejects non-loopback ollamaBaseUrl by default", () => {
    expect(() =>
      parseConfig({
        visionModel: "moondream:latest",
        ollamaBaseUrl: "http://attacker.example.com",
      }),
    ).toThrow()
  })

  it("allows non-loopback ollamaBaseUrl when allowRemoteVision is true", () => {
    const config = parseConfig({
      visionModel: "moondream:latest",
      ollamaBaseUrl: "http://attacker.example.com",
      allowRemoteVision: true,
    })
    expect(config.ollamaBaseUrl).toBe("http://attacker.example.com")
  })

  it("rejects file:// ollamaBaseUrl", () => {
    expect(() =>
      parseConfig({
        visionModel: "moondream:latest",
        ollamaBaseUrl: "file:///etc/passwd",
      }),
    ).toThrow()
  })

  it("rejects persistentDir outside user home", () => {
    expect(() =>
      parseConfig({
        retention: "persistent",
        persistentDir: "/etc/screenshots",
      }),
    ).toThrow()
  })

  it("rejects persistentDir with .. segments", () => {
    expect(() =>
      parseConfig({
        retention: "persistent",
        persistentDir: join(homedir(), "..", "etc"),
      }),
    ).toThrow()
  })

  it("rejects relative persistentDir", () => {
    expect(() =>
      parseConfig({
        retention: "persistent",
        persistentDir: "screenshots",
      }),
    ).toThrow()
  })

  it("accepts persistentDir inside user home", () => {
    const config = parseConfig({
      retention: "persistent",
      persistentDir: join(homedir(), ".local", "share", "screenshots"),
    })
    expect(config.persistentDir).toBe(join(homedir(), ".local", "share", "screenshots"))
  })
})
