import { $, which, readTempFile } from "./shell.js"
import sharp from "sharp"
import type { CaptureAdapter, CaptureResult, CaptureTarget, ActiveWindow } from "./types.js"

async function runActiveWindowScript(): Promise<ActiveWindow> {
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
      set frontWindow to value of attribute "AXTitle" of (front window of first application process whose frontmost is true)
    end tell
    return frontApp & "\n" & frontWindow
  `
  const result = await $`osascript -e ${script}`
  const [appName, title] = result.stdout.split("\n")
  return { appName: appName ?? "", title: title ?? "" }
}

async function captureFullScreen(): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  await $`screencapture -x ${tmpFile}`
  return readTempFile(tmpFile)
}

async function countOnlineDisplays(): Promise<number> {
  try {
    const result = await $`system_profiler SPDisplaysDataType -json`
    const data = JSON.parse(result.stdout)
    const displays = data?.SPDisplaysDataType?.[0]?.["spdisplays_ndrvs"] ?? []
    return Math.max(1, displays.length)
  } catch {
    return 1
  }
}

async function captureAllDisplays(): Promise<Buffer> {
  const count = await countOnlineDisplays()
  const base = `/tmp/opencode-dc-${Date.now()}`
  const files = Array.from({ length: count }, (_, i) => `${base}-${i}.png`)
  await $`screencapture -x ${files}`

  if (files.length === 1) {
    return readTempFile(files[0])
  }

  const images = await Promise.all(
    files.map(async (file) => {
      const meta = await sharp(file).metadata()
      return { file, width: meta.width ?? 0, height: meta.height ?? 0 }
    }),
  )

  const totalWidth = images.reduce((sum, img) => sum + img.width, 0)
  const maxHeight = Math.max(...images.map((img) => img.height))

  let left = 0
  const composite = images.map((img) => {
    const offset = { input: img.file, left, top: 0 }
    left += img.width
    return offset
  })

  return sharp({
    create: {
      width: totalWidth,
      height: maxHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png()
    .toBuffer()
}

async function captureActiveWindow(): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  await $`screencapture -x -w ${tmpFile}`
  return readTempFile(tmpFile)
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
    return which("screencapture")
  },
}
