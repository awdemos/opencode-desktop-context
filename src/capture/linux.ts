import { $ } from "bun"
import type { CaptureAdapter, CaptureResult, CaptureTarget, ActiveWindow } from "./types.js"

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`
    return true
  } catch {
    return false
  }
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
      const json = await $`hyprctl activewindow -j`.json()
      return { appName: json.class ?? "", title: json.title ?? "" }
    }
    if (compositor === "sway") {
      const json = await $`swaymsg -t get_tree`.json()
      const focused = findFocused(json)
      return { appName: focused?.app_id ?? "", title: focused?.name ?? "" }
    }
    if (compositor === "niri") {
      const result = await $`niri msg --json focused-window`.text()
      const json = JSON.parse(result)
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
    const id = await $`xprop -root _NET_ACTIVE_WINDOW`.text()
    const match = id.match(/0x[0-9a-fA-F]+/)
    if (!match) return { appName: "", title: "" }
    const windowId = match[0]
    const [appName, title] = await Promise.all([
      $`xprop -id ${windowId} WM_CLASS`.text().catch(() => ""),
      $`xprop -id ${windowId} _NET_WM_NAME`.text().catch(() => ""),
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
      const json = await $`hyprctl activewindow -j`.json()
      const box = `${json.at[0]},${json.at[1]} ${json.size[0]}x${json.size[1]}`
      await $`grim -g ${box} ${tmpFile}`
    } else if (await commandExists("slurp")) {
      const geometry = await $`slurp`.text()
      await $`grim -g ${geometry.trim()} ${tmpFile}`
    } else {
      await $`grim ${tmpFile}`
    }
  } else {
    await $`grim ${tmpFile}`
  }
  return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
}

async function captureX11(target: CaptureTarget): Promise<Buffer> {
  const tmpFile = `/tmp/opencode-dc-${Date.now()}.png`
  if (target === "activeWindow") {
    if (await commandExists("import")) {
      await $`import -window $(xprop -root _NET_ACTIVE_WINDOW | grep -o '0x[0-9a-fA-F]*') ${tmpFile}`
      return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
    }
  }
  if (await commandExists("import")) {
    await $`import -window root ${tmpFile}`
    return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
  }
  const display = process.env.DISPLAY ?? ":0"
  await $`ffmpeg -f x11grab -i ${display} -vframes 1 ${tmpFile}`
  return Buffer.from(await Bun.file(tmpFile).arrayBuffer())
}

async function captureLinux(target: CaptureTarget): Promise<Buffer> {
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
    return process.platform === "linux"
  },
}
