import { describe, it, expect } from "bun:test"
import { createChatMessageHook } from "../src/hooks/chat-message"
import type { CaptureOrchestrator } from "../src/capture/index"
import type { Config } from "../src/config"
import type { Part, UserMessage } from "@opencode-ai/sdk"
import type { VisionClient } from "../src/vision"

function makeMockOrchestrator(capture: ReturnType<CaptureOrchestrator["captureIfAllowed"]> | null = null): CaptureOrchestrator {
  return {
    captureIfAllowed: async () => capture,
    clearCache: () => {},
  } as unknown as CaptureOrchestrator
}

function makeOutput(): { message: UserMessage; parts: Part[] } {
  return {
    message: { id: "msg_test", role: "user", content: "hello" } as unknown as UserMessage,
    parts: [],
  }
}

describe("createChatMessageHook", () => {
  it("does nothing when autoAttach is disabled", async () => {
    const hook = createChatMessageHook(makeMockOrchestrator({ buffer: Buffer.alloc(1), format: "png", capturedAt: 1 }), {
      autoAttach: false,
    } as Config)
    const output = makeOutput()
    await hook({ sessionID: "ses_test" }, output)
    expect(output.parts).toHaveLength(0)
  })

  it("does nothing when capture is null", async () => {
    const hook = createChatMessageHook(makeMockOrchestrator(null), { autoAttach: true } as Config)
    const output = makeOutput()
    await hook({ sessionID: "ses_test" }, output)
    expect(output.parts).toHaveLength(0)
  })

  it("pushes a file part with an opencode-valid id prefix", async () => {
    const hook = createChatMessageHook(
      makeMockOrchestrator({ buffer: Buffer.from("fake"), format: "png", capturedAt: 12345 }),
      { autoAttach: true } as Config,
    )
    const output = makeOutput()
    await hook({ sessionID: "ses_test" }, output)

    expect(output.parts).toHaveLength(1)
    const part = output.parts[0] as Extract<Part, { type: "file" }>
    expect(part.type).toBe("file")
    expect(part.id).toMatch(/^prt-/)
    expect(part.sessionID).toBe("ses_test")
    expect(part.messageID).toBe("msg_test")
    expect(part.mime).toBe("image/png")
    expect(part.url).toStartWith("data:image/png;base64,")
    expect(part.filename).toBe("desktop-12345.png")
  })

  it("uses file:// url when capture has a path", async () => {
    const hook = createChatMessageHook(
      makeMockOrchestrator({ buffer: Buffer.from("fake"), format: "jpeg", capturedAt: 67890, path: "/tmp/capture.jpg" }),
      { autoAttach: true } as Config,
    )
    const output = makeOutput()
    await hook({ sessionID: "ses_test" }, output)

    const part = output.parts[0] as Extract<Part, { type: "file" }>
    expect(part.id).toMatch(/^prt-/)
    expect(part.url).toBe("file:///tmp/capture.jpg")
    expect(part.mime).toBe("image/jpeg")
  })

  it("pushes a text part when visionModel is configured", async () => {
    const capture = { buffer: Buffer.from("fake"), format: "png" as const, capturedAt: 11111 }
    const visionClient: VisionClient = {
      describeImage: async () => "A terminal window with code.",
    }
    const hook = createChatMessageHook(makeMockOrchestrator(capture), {
      autoAttach: true,
      visionModel: "moondream:latest",
    } as Config, visionClient)
    const output = makeOutput()
    await hook({ sessionID: "ses_test" }, output)

    expect(output.parts).toHaveLength(1)
    const part = output.parts[0] as Extract<Part, { type: "text" }>
    expect(part.type).toBe("text")
    expect(part.text).toContain("A terminal window with code.")
  })
})
