import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { createTempStorage, createPersistentStorage, getTempStorageDir, validatePersistentDir } from "../src/storage"
import { rm, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const tmpDir = getTempStorageDir() + "-test"

describe("storage", () => {
  beforeEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })
  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it("temp storage saves to Pictures/opencode-desktop-context", async () => {
    const storage = createTempStorage()
    const capture = { buffer: Buffer.from("img"), format: "png" as const, capturedAt: Date.now() }
    const stored = await storage.save(capture)
    expect(stored.path).toBeDefined()
    expect(stored.path?.startsWith(getTempStorageDir())).toBe(true)
  })

  it("persistent storage saves to provided directory", async () => {
    const storage = createPersistentStorage(tmpDir)
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

  it("validatePersistentDir accepts home subdirectory", () => {
    expect(() => validatePersistentDir(join(homedir(), ".local", "share", "screenshots"))).not.toThrow()
  })
})
