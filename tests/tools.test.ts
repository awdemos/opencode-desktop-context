import { describe, it, expect } from "bun:test"
import { createCaptureDesktopTool } from "../src/tools/capture-desktop"
import { createDescribeDesktopTool } from "../src/tools/describe-desktop"
import type { CaptureOrchestrator } from "../src/capture/index"
import type { VisionClient } from "../src/vision"
import type { ToolContext } from "@opencode-ai/plugin"

const mockContext = {
  sessionID: "ses_test",
  messageID: "msg_test",
  agent: "test",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
} as unknown as ToolContext

function makeOrchestrator(capture: ReturnType<CaptureOrchestrator["captureIfAllowed"]> | null): CaptureOrchestrator {
  return {
    captureIfAllowed: async () => capture,
    clearCache: () => {},
  } as unknown as CaptureOrchestrator
}

describe("createCaptureDesktopTool", () => {
  it("returns an attachment when capture succeeds from buffer", async () => {
    const t = createCaptureDesktopTool(makeOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 12345 }))
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
    const t = createCaptureDesktopTool(
      makeOrchestrator({ buffer: Buffer.from("fake"), format: "jpeg", capturedAt: 67890, path: "/tmp/capture.jpg" }),
    )
    const result = await t.execute({ reason: "test" }, mockContext)
    const attachments = (result as { attachments: Array<{ url: string; mime: string }> }).attachments
    expect(attachments[0].url).toBe("file:///tmp/capture.jpg")
    expect(attachments[0].mime).toBe("image/jpeg")
  })

  it("reports blocked capture", async () => {
    const t = createCaptureDesktopTool(makeOrchestrator(null))
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop capture blocked")
    expect(result).toHaveProperty("output", expect.stringContaining("blocked"))
  })

  it("reports capture errors", async () => {
    const t = createCaptureDesktopTool({
      captureIfAllowed: async () => {
        throw new Error("capture exploded")
      },
      clearCache: () => {},
    } as unknown as CaptureOrchestrator)
    const result = await t.execute({ reason: "test" }, mockContext)
    expect(result).toHaveProperty("title", "Desktop capture failed")
    expect(result).toHaveProperty("output", "capture exploded")
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
