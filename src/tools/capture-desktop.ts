import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { CaptureOrchestrator } from "../capture/index.js"

export function createCaptureDesktopTool(orchestrator: CaptureOrchestrator): ToolDefinition {
  return tool({
    description: "Capture the user's desktop and return it as an image. Use this when you need to see what is currently on the user's screen to answer a question or debug an issue.",
    args: {
      reason: tool.schema.string().optional().describe("Brief reason for capturing the screen"),
    },
    async execute(args, context) {
      const capture = await orchestrator.captureIfAllowed({ force: true })
      if (!capture) {
        return {
          title: "Desktop capture blocked",
          output: "Screen capture was blocked by the plugin's privacy settings or permission was not granted.",
        }
      }

      const url = capture.path ? `file://${capture.path}` : `data:image/${capture.format};base64,${capture.buffer.toString("base64")}`

      return {
        title: "Desktop captured",
        output: `Captured desktop at ${new Date(capture.capturedAt).toISOString()}.`,
        attachments: [
          {
            type: "file",
            mime: capture.format === "png" ? "image/png" : "image/jpeg",
            url,
            filename: `desktop-${capture.capturedAt}.${capture.format}`,
          },
        ],
      }
    },
  })
}
