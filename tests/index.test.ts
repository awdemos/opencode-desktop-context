import { describe, it, expect } from "bun:test"
import { DesktopContextPlugin } from "../src/index"
import type { PluginInput } from "@opencode-ai/plugin"

const mockInput: PluginInput = {
  client: {
    app: {
      log: async () => {},
    },
  } as any,
  project: { id: "test", name: "test" } as any,
  directory: "/tmp",
  worktree: "/tmp",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost:4096"),
  $: {} as any,
}

describe("DesktopContextPlugin", () => {
  it("returns hooks object", async () => {
    const hooks = await DesktopContextPlugin(mockInput, {
      retention: "memory",
      visualIndicator: false,
    })
    expect(hooks.tool).toBeDefined()
    expect(hooks.tool?.capture_desktop).toBeDefined()
    expect(hooks["chat.message"]).toBeDefined()
  })
})
