import { $ } from "bun"
import type { CaptureAdapter, CaptureResult, CaptureTarget, ActiveWindow } from "./types.js"

async function getActiveWindowInfo(): Promise<ActiveWindow> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[void][Win32]::GetWindowText($hwnd, $title, 256)
$processId = 0
[void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
@($process.ProcessName, $title.ToString()) -join "\n"
`
  const result = await $`powershell.exe -NoProfile -Command ${script}`.text()
  const [appName, title] = result.trim().split("\n")
  return { appName: appName ?? "", title: title ?? "" }
}

async function captureScreen(target: CaptureTarget): Promise<Buffer> {
  const activeWindow = target === "activeWindow" ? "$true" : "$false"
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$path = "$env:TEMP\\opencode-dc-${Date.now()}.png"
if (${activeWindow}) {
  Add-Type @"
  using System; using System.Runtime.InteropServices; using System.Drawing;
  public class CaptureWin { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect); [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, uint nFlags); public struct RECT { public int Left, Top, Right, Bottom; } }
"@
  $hwnd = [CaptureWin]::GetForegroundWindow()
  $rect = New-Object CaptureWin+RECT
  [void][CaptureWin]::GetWindowRect($hwnd, [ref]$rect)
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  [void][CaptureWin]::PrintWindow($hwnd, $gfx.GetHdc(), 0)
  $gfx.ReleaseHdc()
  $bmp.Save($path)
} else {
  $screens = [System.Windows.Forms.Screen]::AllScreens
  $left = 0; $top = 0; $right = 0; $bottom = 0
  foreach ($s in $screens) { if ($s.Bounds.Left -lt $left) { $left = $s.Bounds.Left }; if ($s.Bounds.Top -lt $top) { $top = $s.Bounds.Top }; if ($s.Bounds.Right -gt $right) { $right = $s.Bounds.Right }; if ($s.Bounds.Bottom -gt $bottom) { $bottom = $s.Bounds.Bottom } }
  $w = $right - $left; $h = $bottom - $top
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.CopyFromScreen($left, $top, 0, 0, $bmp.Size)
  $bmp.Save($path)
}
[System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($path))
`
  const result = await $`powershell.exe -NoProfile -Command ${script}`.text()
  return Buffer.from(result.trim(), "base64")
}

export const windowsAdapter: CaptureAdapter = {
  name: "Windows",
  async getActiveWindow() {
    return getActiveWindowInfo()
  },
  async capture(target) {
    const buffer = await captureScreen(target)
    return { buffer, format: "png" }
  },
  async isAvailable() {
    return process.platform === "win32"
  },
}
