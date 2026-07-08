import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { createTempStorage, createPersistentStorage, getTempStorageDir } from "../src/storage"
import { rm, readdir } from "node:fs/promises"
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
})
