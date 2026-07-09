import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { CaptureOrchestrator } from "../capture/index.js"
import type { VisionClient } from "../vision.js"

export function createDescribeDesktopTool(orchestrator: CaptureOrchestrator, visionClient: VisionClient): ToolDefinition {
  return tool({
    description:
      "Capture the user's desktop, describe it using a local vision model, and return a text summary. Use this when you need to understand what is on the user's screen without sending raw images to the cloud.",
    args: {
      reason: tool.schema.string().optional().describe("Brief reason for describing the screen"),
      prompt: tool.schema
        .string()
        .optional()
        .describe("Specific question or prompt to ask the local vision model about the screenshot"),
    },
    async execute(args) {
      try {
        const capture = await orchestrator.captureIfAllowed({ force: true })
        if (!capture) {
          return {
            title: "Desktop description blocked",
            output: "Screen capture was blocked by the plugin's privacy settings or permission was not granted.",
          }
        }

        const description = await visionClient.describeImage(
          capture.buffer,
          capture.format,
          args.prompt ?? "Describe this screenshot and transcribe any readable text.",
        )

        return {
          title: "Desktop described",
          output: description,
        }
      } catch (err) {
        return {
          title: "Desktop description failed",
          output: err instanceof Error ? err.message : String(err),
        }
      }
    },
  })
}
