import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { Effect } from "effect"
import { createCaptureDesktopTool } from "../src/tools/capture-desktop"
import { createDescribeDesktopTool } from "../src/tools/describe-desktop"
import type { CaptureOrchestrator } from "../src/capture/index"
import type { VisionClient } from "../src/vision"
import type { ToolContext } from "@opencode-ai/plugin"
import { savePermissionState, loadPermissionState } from "../src/privacy"
import { rm } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const PERMISSION_FILE = join(homedir(), ".config", "opencode", "desktop-context-permission.json")

const mockContext = {
  sessionID: "ses_test",
  messageID: "msg_test",
  agent: "test",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: () => Effect.void,
} as unknown as ToolContext

function makeOrchestrator(capture: ReturnType<CaptureOrchestrator["captureIfAllowed"]> | null): CaptureOrchestrator {
  return {
    captureIfAllowed: async () => capture,
    clearCache: () => {},
  } as unknown as CaptureOrchestrator
}

function makeTool(
  orchestrator: CaptureOrchestrator,
  options: { requestPermission?: (ctx: ToolContext) => Promise<boolean>; cooldownMs?: number } = {},
) {
  return createCaptureDesktopTool({
    captureIfAllowed: orchestrator.captureIfAllowed,
    clearCache: orchestrator.clearCache,
    requestPermission: options.requestPermission ?? (async () => true),
    cooldownMs: options.cooldownMs ?? 0,
  })
}

describe("createCaptureDesktopTool", () => {
  beforeEach(async () => {
    await rm(PERMISSION_FILE, { force: true })
  })
  afterEach(async () => {
    await rm(PERMISSION_FILE, { force: true })
  })

  it("returns an attachment when capture succeeds from buffer", async () => {
    const t = makeTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 12345 }))
    const result = await t.execute({ reason: "test" }, mockContext)

    expect(typeof result).toBe("object")
    expect(result).toHaveProperty("title", "Desktop captured")
    expect(result).toHaveProperty("output", "Captured desktop at 1970-01-01T00:00:12.345Z.")
    expect(result).toHaveProperty("attachments")
    const attachments = (result as { attachments: Array<{ type: string; mime: string; url: string; filename: string }> }).attachments
    expect(attachments).toHaveLength(1)
    expect(attachments[0].type).toBe("file")
    expect(attachments[0].mime).toBe("image/png")
    expect(attachments[0].url).toStartWith("data:image/png;base64,")
    expect(attachments[0].filename).toBe("desktop-12345.png")
  })

  it("uses file:// url when capture has a path", async () => {
    const t = makeTool(
      makeOrchestrator({ buffer: Buffer.from("fake"), format: "jpeg", capturedAt: 67890, path: "/tmp/capture.jpg" }),
    )
    const result = await t.execute({ reason: "test" }, mockContext)
    const attachments = (result as { attachments: Array<{ url: string; mime: string }> }).attachments
    expect(attachments[0].url).toBe("file:///tmp/capture.jpg")
    expect(attachments[0].mime).toBe("image/jpeg")
  })

  it("reports blocked capture when permission is denied", async () => {
    const t = makeTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), {
      requestPermission: async () => false,
    })
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop capture blocked")
    expect(result).toHaveProperty("output", expect.stringContaining("permission was not granted"))
  })

  it("requests permission and captures when granted", async () => {
    await savePermissionState({ granted: false })
    const t = makeTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), {
      requestPermission: async () => {
        await savePermissionState({ granted: true })
        return true
      },
    })
    const result = await t.execute({ reason: "test" }, mockContext)
    const state = await loadPermissionState()
    expect(state.granted).toBe(true)
    expect(result).toHaveProperty("title", "Desktop captured")
  })

  it("reports capture errors", async () => {
    const t = makeTool({
      captureIfAllowed: async () => {
        throw new Error("capture exploded")
      },
      clearCache: () => {},
    } as unknown as CaptureOrchestrator)
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop capture failed")
    expect(result).toHaveProperty("output", "capture exploded")
  })

  it("rate limits rapid capture requests", async () => {
    const t = makeTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), {
      cooldownMs: 1000,
    })
    const first = await t.execute({ reason: "test" }, mockContext)
    expect(first).toHaveProperty("title", "Desktop captured")
    const second = await t.execute({ reason: "test" }, mockContext)
    expect(second).toHaveProperty("title", "Desktop capture rate limited")
  })
})

describe("createDescribeDesktopTool", () => {
  it("returns a description when capture and vision succeed", async () => {
    const visionClient: VisionClient = {
      describeImage: async (_buffer, _format, prompt) => `description using prompt: ${prompt}`,
    }
    const t = createDescribeDesktopTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), visionClient)
    const result = await t.execute({ reason: "test", prompt: "custom prompt" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop described")
    expect(result).toHaveProperty("output", "description using prompt: custom prompt")
  })

  it("uses default prompt when none provided", async () => {
    const visionClient: VisionClient = {
      describeImage: async (_buffer, _format, prompt) => `got: ${prompt}`,
    }
    const t = createDescribeDesktopTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), visionClient)
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("output", "got: Describe this screenshot and transcribe any readable text.")
  })

  it("reports blocked capture", async () => {
    const visionClient: VisionClient = { describeImage: async () => "should not run" }
    const t = createDescribeDesktopTool(makeOrchestrator(null), visionClient)
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop description blocked")
    expect(result).toHaveProperty("output", expect.stringContaining("blocked"))
  })

  it("reports vision errors", async () => {
    const visionClient: VisionClient = {
      describeImage: async () => {
        throw new Error("vision exploded")
      },
    }
    const t = createDescribeDesktopTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 1 }), visionClient)
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop description failed")
    expect(result).toHaveProperty("output", "vision exploded")
  })
})
