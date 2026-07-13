import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { loadPermissionState, savePermissionState, hasGrantedPermission } from "../src/privacy"
import { rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const PERMISSION_FILE = join(homedir(), ".config", "opencode", "desktop-context-permission.json")

describe("permission", () => {
  beforeEach(async () => {
    await rm(PERMISSION_FILE, { force: true })
  })
  afterEach(async () => {
    await rm(PERMISSION_FILE, { force: true })
  })

  it("defaults to not granted", async () => {
    const state = await loadPermissionState()
    expect(hasGrantedPermission(state)).toBe(false)
  })

  it("saves and loads granted state", async () => {
    await savePermissionState({ granted: true, askedAt: new Date().toISOString() })
    const state = await loadPermissionState()
    expect(hasGrantedPermission(state)).toBe(true)
  })

  it("falls back to not granted for malformed JSON", async () => {
    await savePermissionState({ granted: true, askedAt: new Date().toISOString() })
    await writeFile(PERMISSION_FILE, "not json")
    const state = await loadPermissionState()
    expect(hasGrantedPermission(state)).toBe(false)
  })

  it("falls back to not granted for invalid permission shape", async () => {
    await savePermissionState({ granted: true, askedAt: new Date().toISOString() })
    await writeFile(PERMISSION_FILE, JSON.stringify({ granted: "yes" }))
    const state = await loadPermissionState()
    expect(hasGrantedPermission(state)).toBe(false)
  })
})
