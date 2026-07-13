import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { createTempStorage, createPersistentStorage, getTempStorageDir, validatePersistentDir } from "../src/storage"
import { mkdir, mkdtemp, rm, readdir, symlink, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, resolve } from "node:path"

const tmpDir = getTempStorageDir() + "-test"

const originalEnv = { ...process.env }

describe("storage", () => {
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
  })

  it("temp storage saves to Pictures/opencode-desktop-context", async () => {
    const storage = createTempStorage()
    const capture = { buffer: Buffer.from("img"), format: "png" as const, capturedAt: Date.now() }
    const stored = await storage.save(capture)
    expect(stored.path).toBeDefined()
    expect(stored.path?.startsWith(getTempStorageDir())).toBe(true)
  })

  it("persistent storage saves to provided directory", async () => {
    const storage = await createPersistentStorage(tmpDir)
    const capture = { buffer: Buffer.from("img"), format: "png" as const, capturedAt: Date.now() }
    const stored = await storage.save(capture)
    expect(stored.path?.startsWith(tmpDir)).toBe(true)
    const files = await readdir(tmpDir)
    expect(files.length).toBe(1)
  })

  it("rejects persistentDir outside user home", () => {
    expect(() => createPersistentStorage("/etc/screenshots")).toThrow("within the user home directory")
  })

  it("rejects persistentDir with .. segments", () => {
    expect(() => createPersistentStorage(`${homedir()}/../etc`)).toThrow("'..'")
  })

  it("rejects relative persistentDir", () => {
    expect(() => createPersistentStorage("screenshots")).toThrow("absolute path")
  })

  it("validatePersistentDir accepts home subdirectory", async () => {
    await expect(validatePersistentDir(join(homedir(), ".local", "share", "screenshots"))).resolves.toBeUndefined()
  })

  it("validatePersistentDir rejects paths resolved through symlinks outside home", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "odc-workspace-"))
    const dir = join(workspace, "screenshots")
    await mkdir(dir, { recursive: true })
    const outside = resolve(homedir(), "..")
    const link = join(workspace, "link")
    await symlink(outside, link)
    await expect(validatePersistentDir(join(link, "screenshots"))).rejects.toThrow()
    await rm(workspace, { recursive: true, force: true })
  })

  it("validatePersistentDir accepts paths within explicit workspace root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "odc-workspace-"))
    process.env.OPENCODE_DESKTOP_CONTEXT_WORKSPACE_ROOT = workspace
    const dir = join(workspace, "screenshots")
    await expect(validatePersistentDir(dir)).resolves.toBeUndefined()
    await rm(workspace, { recursive: true, force: true })
  })

  it("createPersistentStorage rejects traversal before writing", async () => {
    await expect(createPersistentStorage(join(homedir(), "..", "etc"))).rejects.toThrow()
  })
})
