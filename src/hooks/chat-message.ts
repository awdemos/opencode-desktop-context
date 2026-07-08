import type { Hooks } from "@opencode-ai/plugin"
import type { CaptureOrchestrator } from "../capture/index.js"
import type { Config } from "../config.js"

export function createChatMessageHook(orchestrator: CaptureOrchestrator, config: Config): Hooks["chat.message"] {
  return async (input, output) => {
    if (!config.autoAttach) return

    const capture = await orchestrator.captureIfAllowed()
    if (!capture) return

    const url = capture.path ? `file://${capture.path}` : `data:image/${capture.format};base64,${capture.buffer.toString("base64")}`

    output.parts.push({
      id: `desktop-${capture.capturedAt}`,
      sessionID: input.sessionID,
      messageID: output.message.id,
      type: "file",
      mime: capture.format === "png" ? "image/png" : "image/jpeg",
      url,
      filename: `desktop-${capture.capturedAt}.${capture.format}`,
    })
  }
}
