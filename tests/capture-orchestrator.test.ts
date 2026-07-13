import { describe, it, expect, beforeEach } from "bun:test"
import sharp from "sharp"
import { createCaptureOrchestrator } from "../src/capture"
import { createMemoryStorage } from "../src/storage"
import type { CaptureAdapter, CaptureResult, StoredCapture } from "../src/capture/types"
import type { Config } from "../src/config"

async function createPngBuffer(color: string): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: color } }).png().toBuffer()
}

const fakeAdapter: CaptureAdapter = {
  name: "Fake",
  async getActiveWindow() {
    return { title: "Code", appName: "Code" }
  },
  async capture(target): Promise<CaptureResult> {
    return { buffer: await createPngBuffer("red"), format: "png" }
  },
  async isAvailable() {
    return true
  },
}

const baseConfig: Config = {
  captureTarget: "fullScreen",
  maxAgeMs: 1000,
  autoAttach: true,
  systemHint: false,
  visualIndicator: false,
  retention: "memory",
  retentionTtlMs: 600000,
  periodicCaptureMs: 0,
  allowRemoteVision: false,
  captureCooldownMs: 1000,
  blocklist: [],
  allowlist: [],
  quality: 80,
}

describe("createCaptureOrchestrator", () => {
  it("returns null when blocked", async () => {
    const adapter: CaptureAdapter = {
      ...fakeAdapter,
      async getActiveWindow() {
        return { title: "1Password", appName: "1Password" }
      },
    }
    const orchestrator = createCaptureOrchestrator(adapter, { ...baseConfig, blocklist: ["1Password"] }, createMemoryStorage())
    const result = await orchestrator.captureIfAllowed()
    expect(result).toBeNull()
  })

  it("caches result within maxAgeMs", async () => {
    let calls = 0
    const adapter: CaptureAdapter = {
      ...fakeAdapter,
      async capture() {
        calls++
        return { buffer: await createPngBuffer(calls === 1 ? "red" : "blue"), format: "png" }
      },
    }
    const orchestrator = createCaptureOrchestrator(adapter, baseConfig, createMemoryStorage())
    const first = await orchestrator.captureIfAllowed()
    const second = await orchestrator.captureIfAllowed()
    expect(calls).toBe(1)
    expect(first?.buffer.length).toBe(second?.buffer.length)
  })

  it("bypasses cache for force capture", async () => {
    let calls = 0
    const adapter: CaptureAdapter = {
      ...fakeAdapter,
      async capture() {
        calls++
        return { buffer: await createPngBuffer(calls === 1 ? "red" : "blue"), format: "png" }
      },
    }
    const orchestrator = createCaptureOrchestrator(adapter, baseConfig, createMemoryStorage())
    await orchestrator.captureIfAllowed()
    await orchestrator.captureIfAllowed({ force: true })
    expect(calls).toBe(2)
  })
})
