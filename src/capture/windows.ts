import { $, readTempFile } from "./shell.js"
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
  const result = await $`powershell.exe -NoProfile -Command ${script}`
  const [appName, title] = result.stdout.trim().split("\n")
  return { appName: appName ?? "", title: title ?? "" }
}

async function captureScreen(target: CaptureTarget): Promise<Buffer> {
  const activeWindow = target === "activeWindow" ? "$true" : "$false"
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class CaptureWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);
  public struct RECT { public int Left, Top, Right, Bottom; }
  public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
}
"@
$path = "$env:TEMP\\opencode-dc-${Date.now()}.png"
if (${activeWindow}) {
  $hwnd = [CaptureWin]::GetForegroundWindow()
  $rect = New-Object CaptureWin+RECT
  # DWM bounds are in physical pixels and exclude the drop shadow; fall back to GetWindowRect if DWM fails.
  $dwmOk = [CaptureWin]::DwmGetWindowAttribute($hwnd, [CaptureWin]::DWMWA_EXTENDED_FRAME_BOUNDS, [ref]$rect, [System.Runtime.InteropServices.Marshal]::SizeOf([CaptureWin+RECT])) -eq 0
  if (-not $dwmOk) {
    [void][CaptureWin]::GetWindowRect($hwnd, [ref]$rect)
  }
  $w = $rect.Right - $rect.Left
  $h = $rect.Bottom - $rect.Top
  if ($w -le 0 -or $h -le 0) {
    throw "Unable to determine active window bounds"
  }
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.CopyFromScreen($rect.Left, $rect.Top, 0, 0, New-Object System.Drawing.Size($w, $h))
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
  const result = await $`powershell.exe -NoProfile -Command ${script}`
  return Buffer.from(result.stdout.trim(), "base64")
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
    if (process.platform !== "win32") return false
    try {
      await $`powershell.exe -NoProfile -Command "exit 0"`
      return true
    } catch {
      return false
    }
  },
}
