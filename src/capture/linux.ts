import { $, which, readTempFile } from "./shell.js"
import type { CaptureAdapter, CaptureResult, CaptureTarget, ActiveWindow } from "./types.js"

async function commandExists(cmd: string): Promise<boolean> {
  return which(cmd)
}

async function getWaylandCompositor(): Promise<"hyprland" | "sway" | "niri" | null> {
  const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? ""
  if (desktop.includes("hypr")) return "hyprland"
  if (desktop.includes("sway")) return "sway"
  if (desktop.includes("niri")) return "niri"
  if (await commandExists("hyprctl")) return "hyprland"
  if (await commandExists("swaymsg")) return "sway"
  if (await commandExists("niri")) return "niri"
  return null
}

async function getActiveWindowWayland(): Promise<ActiveWindow> {
  const compositor = await getWaylandCompositor()
  try {
    if (compositor === "hyprland") {
      const result = await $`hyprctl activewindow -j`
      const json = JSON.parse(result.stdout)
      return { appName: json.class ?? "", title: json.title ?? "" }
    }
    if (compositor === "sway") {
      const result = await $`swaymsg -t get_tree`
      const json = JSON.parse(result.stdout)
      const focused = findFocused(json)
      return { appName: focused?.app_id ?? "", title: focused?.name ?? "" }
    }
    if (compositor === "niri") {
      const result = await $`niri msg --json focused-window`
      const json = JSON.parse(result.stdout)
      return { appName: json.app_id ?? "", title: json.title ?? "" }
    }
  } catch {
    // ignore
  }
  return { appName: "", title: "" }
}

function findFocused(node: any): any {
  if (!node) return null
  if (node.focused) return node
  if (node.nodes) {
    for (const child of node.nodes) {
      const found = findFocused(child)
      if (found) return found
    }
  }
  if (node.floating_nodes) {
    for (const child of node.floating_nodes) {
      const found = findFocused(child)
      if (found) return found
    }
  }
  return null
}

async function getActiveWindowX11(): Promise<ActiveWindow> {
  try {
    const id = await $`xprop -root _NET_ACTIVE_WINDOW`
    const match = id.stdout.match(/0x[0-9a-fA-F]+/)
    if (!match) return { appName: "", title: "" }
    const windowId = match[0]
    const [appName, title] = await Promise.all([
      $`xprop -id ${windowId} WM_CLASS`.then(r => r.stdout).catch(() => ""),
      $`xprop -id ${windowId} _NET_WM_NAME`.then(r => r.stdout).catch(() => ""),
    ])
    return {
      appName: appName.split("").pop()?.replace(/"/g, "").trim() ?? "",
      title: title.split("=")[1]?.replace(/"/g, "").trim() ?? "",
    }
  } catch {
    return { appName: "", title: "" }
  }
}

async function getActiveWindow(): Promise<ActiveWindow> {
  const wayland = process.env.WAYLAND_DISPLAY
  if (wayland) return getActiveWindowWayland()
  return getActiveWindowX11()
}

async function captureWayland(target: CaptureTarget): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  if (target === "activeWindow") {
    const compositor = await getWaylandCompositor()
    if (compositor === "hyprland") {
      const result = await $`hyprctl activewindow -j`
      const json = JSON.parse(result.stdout)
      const box = `${json.at[0]},${json.at[1]} ${json.size[0]}x${json.size[1]}`
      await $`grim -g ${box} ${tmpFile}`
    } else if (compositor === "sway") {
      const result = await $`swaymsg -t get_tree`
      const json = JSON.parse(result.stdout)
      const focused = findFocused(json)
      if (focused?.rect) {
        const { x, y, width, height } = focused.rect
        const box = `${x},${y} ${width}x${height}`
        await $`grim -g ${box} ${tmpFile}`
      } else {
        await $`grim ${tmpFile}`
      }
    } else if (compositor === "niri") {
      const result = await $`niri msg --json focused-window`
      const json = JSON.parse(result.stdout)
      if (json?.geometry) {
        const { x, y, width, height } = json.geometry
        const box = `${x},${y} ${width}x${height}`
        await $`grim -g ${box} ${tmpFile}`
      } else {
        await $`grim ${tmpFile}`
      }
    } else {
      await $`grim ${tmpFile}`
    }
  } else {
    await $`grim ${tmpFile}`
  }
  return readTempFile(tmpFile)
}

async function captureX11(target: CaptureTarget): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  if (target === "activeWindow") {
    if (await commandExists("import")) {
      await $`import -window $(xprop -root _NET_ACTIVE_WINDOW | grep -o '0x[0-9a-fA-F]*') ${tmpFile}`
      return readTempFile(tmpFile)
    }
  }
  if (await commandExists("import")) {
    await $`import -window root ${tmpFile}`
    return readTempFile(tmpFile)
  }
  const display = process.env.DISPLAY ?? ":0"
  await $`ffmpeg -f x11grab -i ${display} -vframes 1 ${tmpFile}`
  return readTempFile(tmpFile)
}

type LinuxBackend = "grim" | "import" | "ffmpeg"

async function detectBackend(): Promise<LinuxBackend | null> {
  const wayland = process.env.WAYLAND_DISPLAY
  if (wayland) {
    if (await commandExists("grim")) return "grim"
    return null
  }
  if (await commandExists("import")) return "import"
  if (await commandExists("ffmpeg")) return "ffmpeg"
  return null
}

async function captureLinux(target: CaptureTarget): Promise<Buffer> {
  const backend = await detectBackend()
  if (!backend) {
    throw new Error(
      "No desktop capture tool found. Install one of: grim (Wayland), ImageMagick import (X11), or ffmpeg (X11)."
    )
  }
  const wayland = process.env.WAYLAND_DISPLAY
  if (wayland) return captureWayland(target)
  return captureX11(target)
}

export const linuxAdapter: CaptureAdapter = {
  name: "Linux",
  async getActiveWindow() {
    return getActiveWindow()
  },
  async capture(target) {
    const buffer = await captureLinux(target)
    return { buffer, format: "png" }
  },
  async isAvailable() {
    if (process.platform !== "linux") return false
    return (await detectBackend()) !== null
  },
}
