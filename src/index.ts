import type { Plugin, ToolDefinition } from "@opencode-ai/plugin"
import { parseConfig } from "./config.js"
import { createCaptureOrchestrator } from "./capture/index.js"
import { createStorage } from "./storage.js"
import { loadPermissionState, savePermissionState } from "./privacy/index.js"
import { createCaptureDesktopTool } from "./tools/capture-desktop.js"
import { createDescribeDesktopTool } from "./tools/describe-desktop.js"
import { createChatMessageHook } from "./hooks/chat-message.js"
import { createSystemHintHook } from "./hooks/system-hint.js"
import { createVisionClient } from "./vision.js"
import { getPlatform } from "./capture/types.js"
import { macOSAdapter } from "./capture/macos.js"
import { windowsAdapter } from "./capture/windows.js"
import { linuxAdapter } from "./capture/linux.js"

function getAdapter() {
  switch (getPlatform()) {
    case "darwin":
      return macOSAdapter
    case "win32":
      return windowsAdapter
    case "linux":
      return linuxAdapter
    default:
      return null
  }
}

async function logError(ctx: any, message: string, err?: unknown): Promise<void> {
  const detail = err instanceof Error ? err.message : String(err)
  try {
    await ctx.client.app.log({
      body: { service: "desktop-context", level: "error", message: `${message}: ${detail}` },
    })
  } catch {
    // Last-resort logging so we never crash opencode because of a logging failure.
    console.error(`[desktop-context] ${message}: ${detail}`)
  }
}

export const DesktopContextPlugin: Plugin = async (ctx, options = {}) => {
  try {
    const config = parseConfig(options)
    const adapter = getAdapter()

    if (!adapter) {
      await logError(ctx, "Unsupported platform", new Error(`platform ${process.platform} has no capture adapter`))
      return {}
    }

    const available = await adapter.isAvailable()
    if (!available) {
      await logError(ctx, `Capture adapter ${adapter.name} is not available`)
      return {}
    }

    const storage = createStorage(config.retention, config.persistentDir)
    await storage.cleanup(config.retentionTtlMs).catch(() => {})
    const orchestrator = createCaptureOrchestrator(adapter, config, storage)

    const permissionedOrchestrator = {
      captureIfAllowed: async (opts?: { force?: boolean }) => {
        const perm = await loadPermissionState().catch(() => ({ granted: false }))
        if (!perm.granted) {
          return null
        }
        return orchestrator.captureIfAllowed(opts)
      },
      clearCache: orchestrator.clearCache,
    }

    const visionClient = config.visionModel
      ? createVisionClient({ baseUrl: config.ollamaBaseUrl, model: config.visionModel })
      : undefined

    if (config.periodicCaptureMs > 0) {
      const interval = setInterval(async () => {
        try {
          const perm = await loadPermissionState().catch(() => ({ granted: false }))
          if (!perm.granted) return
          await orchestrator.captureIfAllowed({ force: false }).catch((err) => logError(ctx, "Periodic capture failed", err))
        } catch (err) {
          logError(ctx, "Periodic capture crashed", err).catch(() => {})
        }
      }, config.periodicCaptureMs)
      interval.unref?.()
    }

    const tools: Record<string, ToolDefinition> = {
      capture_desktop: createCaptureDesktopTool({
        captureIfAllowed: async (opts) => {
          let perm = await loadPermissionState().catch(() => ({ granted: false }))
          if (!perm.granted) {
            await savePermissionState({ granted: true, askedAt: new Date().toISOString() }).catch(() => {})
            perm = await loadPermissionState().catch(() => ({ granted: false }))
          }
          if (!perm.granted) return null
          return orchestrator.captureIfAllowed(opts)
        },
        clearCache: orchestrator.clearCache,
      }),
    }

    if (visionClient) {
      tools.describe_desktop = createDescribeDesktopTool(orchestrator, visionClient)
    }

    return {
      "chat.message": createChatMessageHook(permissionedOrchestrator, config, visionClient),
      "experimental.chat.system.transform": createSystemHintHook(config),
      tool: tools,
    }
  } catch (err) {
    await logError(ctx, "DesktopContextPlugin failed to initialize", err)
    return {}
  }
}

export default DesktopContextPlugin
