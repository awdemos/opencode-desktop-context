import type { Hooks } from "@opencode-ai/plugin"
import type { CaptureOrchestrator } from "../capture/index.js"
import type { Config } from "../config.js"
import type { VisionClient } from "../vision.js"

export function createChatMessageHook(
  orchestrator: CaptureOrchestrator,
  config: Config,
  visionClient?: VisionClient,
): Hooks["chat.message"] {
  return async (input, output) => {
    if (!config.autoAttach) return

    try {
      const capture = await orchestrator.captureIfAllowed()
      if (!capture) return

      if (config.visionModel && visionClient) {
        const description = await visionClient.describeImage(
          capture.buffer,
          capture.format,
          "Describe this screenshot and transcribe any readable text.",
        )
        output.parts.push({
          id: `prt-desktop-${capture.capturedAt}`,
          sessionID: input.sessionID,
          messageID: output.message.id,
          type: "text",
          text: `[Desktop context]: ${description}`,
        })
        return
      }

      const url = capture.path ? `file://${capture.path}` : `data:image/${capture.format};base64,${capture.buffer.toString("base64")}`

      output.parts.push({
        id: `prt-desktop-${capture.capturedAt}`,
        sessionID: input.sessionID,
        messageID: output.message.id,
        type: "file",
        mime: capture.format === "png" ? "image/png" : "image/jpeg",
        url,
        filename: `desktop-${capture.capturedAt}.${capture.format}`,
      })
    } catch {
      // Never let a capture failure break the chat message flow.
    }
  }
}
