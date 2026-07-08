import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const PERMISSION_FILE = join(homedir(), ".config", "opencode", "desktop-context-permission.json")

export type PermissionState = {
  granted: boolean
  askedAt?: string
}

export async function loadPermissionState(): Promise<PermissionState> {
  if (!existsSync(PERMISSION_FILE)) return { granted: false }
  try {
    const raw = await readFile(PERMISSION_FILE, "utf-8")
    return JSON.parse(raw) as PermissionState
  } catch {
    return { granted: false }
  }
}

export async function savePermissionState(state: PermissionState): Promise<void> {
  await mkdir(join(homedir(), ".config", "opencode"), { recursive: true })
  await writeFile(PERMISSION_FILE, JSON.stringify(state, null, 2))
}

export function hasGrantedPermission(state: PermissionState): boolean {
  return state.granted === true
}
