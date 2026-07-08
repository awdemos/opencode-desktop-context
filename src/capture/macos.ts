import { $ } from "bun"
import type { CaptureAdapter, CaptureResult, CaptureTarget, ActiveWindow } from "./types.js"

async function runActiveWindowScript(): Promise<ActiveWindow> {
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
      set frontWindow to value of attribute "AXTitle" of (front window of first application process whose frontmost is true)
    end tell
    return frontApp & "\n" & frontWindow
  `
  const result = await $`osascript -e ${script}`.text()
  const [appName, title] = result.split("\n")
  return { appName: appName ?? "", title: title ?? "" }
}

async function captureFullScreen(): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  await $`screencapture -x ${tmpFile}`
  return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
}

async function captureAllDisplays(): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  await $`screencapture -x -D 1 ${tmpFile}`
  return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
}

async function captureActiveWindow(): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  await $`screencapture -x -w ${tmpFile}`
  return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
}

export const macOSAdapter: CaptureAdapter = {
  name: "macOS",
  async getActiveWindow() {
    return runActiveWindowScript()
  },
  async capture(target) {
    let buffer: Buffer
    switch (target) {
      case "allDisplays":
        buffer = await captureAllDisplays()
        break
      case "activeWindow":
        buffer = await captureActiveWindow()
        break
      case "fullScreen":
      default:
        buffer = await captureFullScreen()
    }
    return { buffer, format: "png" }
  },
  async isAvailable() {
    try {
      await $`which screencapture`
      return true
    } catch {
      return false
    }
  },
}
