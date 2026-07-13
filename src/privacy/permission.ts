import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { z } from "zod"

const PERMISSION_FILE = join(homedir(), ".config", "opencode", "desktop-context-permission.json")

const permissionStateSchema = z.object({
  granted: z.boolean(),
  askedAt: z.string().optional(),
})

export type PermissionState = z.infer<typeof permissionStateSchema>

export async function loadPermissionState(): Promise<PermissionState> {
  if (!existsSync(PERMISSION_FILE)) return { granted: false }
  try {
    const raw = await readFile(PERMISSION_FILE, "utf-8")
    return permissionStateSchema.parse(JSON.parse(raw))
  } catch {
    return { granted: false }
  }
}

export async function savePermissionState(state: PermissionState): Promise<void> {
  await mkdir(join(homedir(), ".config", "opencode"), { recursive: true, mode: 0o700 })
  await writeFile(PERMISSION_FILE, JSON.stringify(state, null, 2), { mode: 0o600 })
}

export function hasGrantedPermission(state: PermissionState): boolean {
  return state.granted === true
}
