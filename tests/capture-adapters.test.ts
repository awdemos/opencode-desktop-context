import { describe, it, expect } from "bun:test"
import { linuxAdapter } from "../src/capture/linux"
import { macOSAdapter } from "../src/capture/macos"
import { windowsAdapter } from "../src/capture/windows"
import { getPlatform } from "../src/capture/types"

describe("capture adapters", () => {
  it("linux isAvailable reflects whether capture tooling is installed", async () => {
    const available = await linuxAdapter.isAvailable()
    if (process.platform !== "linux") {
      expect(available).toBe(false)
    }
  })

  it("linux captures a non-empty PNG on this platform", async () => {
    if (process.platform !== "linux") return
    if (!(await linuxAdapter.isAvailable())) return
    const result = await linuxAdapter.capture("fullScreen")
    expect(result.format).toBe("png")
    expect(result.buffer.length).toBeGreaterThan(1000)
  })

  it("linux activeWindow falls back to a non-empty PNG on unknown compositors", async () => {
    if (process.platform !== "linux") return
    if (!(await linuxAdapter.isAvailable())) return
    const result = await linuxAdapter.capture("activeWindow")
    expect(result.format).toBe("png")
    expect(result.buffer.length).toBeGreaterThan(1000)
  })

  it("macOS adapter reports unavailable outside darwin", async () => {
    if (process.platform === "darwin") return
    expect(await macOSAdapter.isAvailable()).toBe(false)
  })

  it("windows adapter reports unavailable outside win32", async () => {
    if (process.platform === "win32") return
    expect(await windowsAdapter.isAvailable()).toBe(false)
  })

  it("getPlatform matches process.platform", () => {
    expect(getPlatform()).toBe(process.platform)
  })
})
