import { join } from "node:path"
import { z } from "zod"
import { $, which, readTempFile, createTempCaptureDir, cleanupTempCaptureDir } from "./shell.js"
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

const hyprlandWindowSchema = z.object({
  class: z.string().optional(),
  title: z.string().optional(),
  at: z.tuple([z.number(), z.number()]),
  size: z.tuple([z.number(), z.number()]),
})

const swayNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    focused: z.boolean().optional(),
    app_id: z.string().optional(),
    name: z.string().optional(),
    nodes: z.array(swayNodeSchema).optional(),
    floating_nodes: z.array(swayNodeSchema).optional(),
    rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
  }),
)

const niriWindowSchema = z.object({
  app_id: z.string().optional(),
  title: z.string().optional(),
  geometry: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
})

function parseHyprlandWindow(json: unknown): ActiveWindow {
  const parsed = hyprlandWindowSchema.safeParse(json)
  if (!parsed.success) return { appName: "", title: "" }
  return { appName: parsed.data.class ?? "", title: parsed.data.title ?? "" }
}

function parseNiriWindow(json: unknown): ActiveWindow {
  const parsed = niriWindowSchema.safeParse(json)
  if (!parsed.success) return { appName: "", title: "" }
  return { appName: parsed.data.app_id ?? "", title: parsed.data.title ?? "" }
}

async function getActiveWindowWayland(): Promise<ActiveWindow> {
  const compositor = await getWaylandCompositor()
  try {
    if (compositor === "hyprland") {
      const result = await $`hyprctl activewindow -j`
      return parseHyprlandWindow(JSON.parse(result.stdout))
    }
    if (compositor === "sway") {
      const result = await $`swaymsg -t get_tree`
      const parsed = swayNodeSchema.safeParse(JSON.parse(result.stdout))
      const focused = parsed.success ? findFocused(parsed.data) : null
      return { appName: focused?.app_id ?? "", title: focused?.name ?? "" }
    }
    if (compositor === "niri") {
      const result = await $`niri msg --json focused-window`
      return parseNiriWindow(JSON.parse(result.stdout))
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
      $`xprop -id ${windowId} WM_CLASS`.then((r) => r.stdout).catch(() => ""),
      $`xprop -id ${windowId} _NET_WM_NAME`.then((r) => r.stdout).catch(() => ""),
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

function buildBox(geometry: { x: number; y: number; width: number; height: number }): string {
  return `${geometry.x},${geometry.y} ${geometry.width}x${geometry.height}`
}

async function captureWayland(target: CaptureTarget): Promise<Buffer> {
  const dir = await createTempCaptureDir()
  try {
    const tmpFile = join(dir, "capture.png")
    if (target === "activeWindow") {
      const compositor = await getWaylandCompositor()
      if (compositor === "hyprland") {
        const result = await $`hyprctl activewindow -j`
        const parsed = hyprlandWindowSchema.safeParse(JSON.parse(result.stdout))
        if (parsed.success) {
          const [x, y] = parsed.data.at
          const [width, height] = parsed.data.size
          await $`grim -g ${buildBox({ x, y, width, height })} ${tmpFile}`
        } else {
          await $`grim ${tmpFile}`
        }
      } else if (compositor === "sway") {
        const result = await $`swaymsg -t get_tree`
        const parsed = swayNodeSchema.safeParse(JSON.parse(result.stdout))
        const focused = parsed.success ? findFocused(parsed.data) : null
        if (focused?.rect) {
          await $`grim -g ${buildBox(focused.rect)} ${tmpFile}`
        } else {
          await $`grim ${tmpFile}`
        }
      } else if (compositor === "niri") {
        const result = await $`niri msg --json focused-window`
        const parsed = niriWindowSchema.safeParse(JSON.parse(result.stdout))
        if (parsed.success && parsed.data.geometry) {
          await $`grim -g ${buildBox(parsed.data.geometry)} ${tmpFile}`
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
  } finally {
    await cleanupTempCaptureDir(dir)
  }
}

async function captureX11(target: CaptureTarget): Promise<Buffer> {
  const dir = await createTempCaptureDir()
  try {
    const tmpFile = join(dir, "capture.png")
    if (target === "activeWindow") {
      if (await commandExists("import")) {
        const idResult = await $`xprop -root _NET_ACTIVE_WINDOW`
        const match = idResult.stdout.match(/0x[0-9a-fA-F]+/)
        if (match) {
          await $`import -window ${match[0]} ${tmpFile}`
        } else {
          await $`import -window root ${tmpFile}`
        }
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
  } finally {
    await cleanupTempCaptureDir(dir)
  }
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
