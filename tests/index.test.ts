import { describe, it, expect } from "bun:test"
import { DesktopContextPlugin } from "../src/index"
import type { PluginInput } from "@opencode-ai/plugin"
import { linuxAdapter } from "../src/capture/linux"
import { macOSAdapter } from "../src/capture/macos"
import { windowsAdapter } from "../src/capture/windows"
import { getPlatform } from "../src/capture/types"

const mockInput = {
  client: {
    app: {
      log: async () => {},
    },
  },
  project: { id: "test", name: "test" },
  directory: "/tmp",
  worktree: "/tmp",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost:4096"),
  $: () => Promise.resolve({ stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), exitCode: 0 }),
} as unknown as PluginInput

async function getAdapterForPlatform() {
  switch (getPlatform()) {
    case "linux":
      return linuxAdapter
    case "darwin":
      return macOSAdapter
    case "win32":
      return windowsAdapter
    default:
      return null
  }
}

describe("DesktopContextPlugin", () => {
  it("returns hooks object when adapter is available", async () => {
    const adapter = await getAdapterForPlatform()
    if (!adapter || !(await adapter.isAvailable())) {
      return
    }
    const hooks = await DesktopContextPlugin(mockInput, {
      retention: "memory",
      visualIndicator: false,
    })
    expect(hooks.tool).toBeDefined()
    expect(hooks.tool?.capture_desktop).toBeDefined()
    expect(hooks["chat.message"]).toBeDefined()
  })

  it("returns empty hooks when adapter is unavailable", async () => {
    const adapter = await getAdapterForPlatform()
    if (adapter && (await adapter.isAvailable())) {
      return
    }
    const hooks = await DesktopContextPlugin(mockInput, {
      retention: "memory",
      visualIndicator: false,
    })
    expect(hooks.tool).toBeUndefined()
    expect(hooks["chat.message"]).toBeUndefined()
  })

  it("returns empty hooks on unsupported platform", async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")
    Object.defineProperty(process, "platform", { value: "freebsd" })
    const hooks = await DesktopContextPlugin(mockInput, {})
    expect(hooks.tool).toBeUndefined()
    expect(hooks["chat.message"]).toBeUndefined()
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform)
    }
  })

  it("survives initialization errors gracefully", async () => {
    const hooks = await DesktopContextPlugin(mockInput, { captureTarget: "invalidTarget" } as unknown as PluginInput)
    expect(hooks.tool).toBeUndefined()
    expect(hooks["chat.message"]).toBeUndefined()
  })

  it("starts periodic capture timer when permission is granted", async () => {
    const adapter = await getAdapterForPlatform()
    if (!adapter || !(await adapter.isAvailable())) {
      return
    }

    const originalLoad = await import("../src/privacy/permission")
    const savedState = await originalLoad.loadPermissionState()
    await originalLoad.savePermissionState({ granted: true })

    let captureCount = 0
    const originalCapture = adapter.capture.bind(adapter)
    adapter.capture = async (...args) => {
      captureCount++
      return originalCapture(...args)
    }

    await DesktopContextPlugin(mockInput, {
      retention: "memory",
      visualIndicator: false,
      periodicCaptureMs: 50,
    })

    await new Promise((resolve) => setTimeout(resolve, 200))

    adapter.capture = originalCapture
    await originalLoad.savePermissionState(savedState)

    expect(captureCount).toBeGreaterThanOrEqual(1)
  })
})
