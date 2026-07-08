import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { StoredCapture } from "./capture/types.js"

export type StorageBackend = "memory" | "temp" | "persistent"

export type Storage = {
  save(capture: StoredCapture): Promise<StoredCapture>
  cleanup(ttlMs: number): Promise<void>
}

export function createMemoryStorage(): Storage {
  return {
    async save(capture) {
      return capture
    },
    async cleanup() {},
  }
}

export function createTempStorage(): Storage {
  const dir = join(tmpdir(), "opencode-desktop-context")
  return {
    async save(capture) {
      await mkdir(dir, { recursive: true })
      const filename = `capture-${capture.capturedAt}.${capture.format}`
      const path = join(dir, filename)
      await writeFile(path, capture.buffer)
      return { ...capture, path }
    },
    async cleanup(ttlMs) {
      const now = Date.now()
      try {
        const files = await readdir(dir)
        for (const file of files) {
          const timestamp = parseInt(file.match(/capture-(\d+)/)?.[1] ?? "0", 10)
          if (timestamp > 0 && now - timestamp > ttlMs) {
            await rm(join(dir, file), { force: true })
          }
        }
      } catch {
        // ignore
      }
    },
  }
}

export function createPersistentStorage(directory: string): Storage {
  return {
    async save(capture) {
      await mkdir(directory, { recursive: true })
      const filename = `capture-${capture.capturedAt}.${capture.format}`
      const path = join(directory, filename)
      await writeFile(path, capture.buffer)
      return { ...capture, path }
    },
    async cleanup() {
      // User-managed cleanup
    },
  }
}

export function createStorage(backend: StorageBackend, persistentDir?: string): Storage {
  switch (backend) {
    case "persistent":
      if (!persistentDir) throw new Error("persistentDir required")
      return createPersistentStorage(persistentDir)
    case "temp":
      return createTempStorage()
    case "memory":
    default:
      return createMemoryStorage()
  }
}
