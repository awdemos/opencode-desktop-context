import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { isAbsolute, join, relative, resolve, normalize } from "node:path"
import type { StoredCapture } from "./capture/types.js"

export type StorageBackend = "memory" | "temp" | "persistent"

export type Storage = {
  save(capture: StoredCapture): Promise<StoredCapture>
  cleanup(ttlMs: number): Promise<void>
}

function isWithinUserHome(dir: string): boolean {
  if (!isAbsolute(dir)) return false
  const home = homedir()
  const rel = relative(resolve(normalize(home)), resolve(normalize(dir)))
  return !rel.startsWith("..") && !isAbsolute(rel)
}

function hasDotDotSegments(input: string): boolean {
  return normalize(input) !== resolve(input) || input.split(/[\\/]/).some((segment) => segment === "..")
}

export function validatePersistentDir(directory: string): void {
  if (!isAbsolute(directory)) {
    throw new Error("persistentDir must be an absolute path")
  }
  if (hasDotDotSegments(directory)) {
    throw new Error("persistentDir must not contain '..' segments")
  }
  if (!isWithinUserHome(directory)) {
    throw new Error("persistentDir must be within the user home directory")
  }
}

export function createMemoryStorage(): Storage {
  return {
    async save(capture) {
      return capture
    },
    async cleanup() {},
  }
}

export function getTempStorageDir(): string {
  return join(homedir(), "Pictures", "opencode-desktop-context")
}

export function createTempStorage(): Storage {
  const dir = getTempStorageDir()
  return {
    async save(capture) {
      await mkdir(dir, { recursive: true, mode: 0o700 })
      const filename = `capture-${capture.capturedAt}.${capture.format}`
      const path = join(dir, filename)
      await writeFile(path, capture.buffer, { mode: 0o600 })
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
  validatePersistentDir(directory)
  return {
    async save(capture) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const filename = `capture-${capture.capturedAt}.${capture.format}`
      const path = join(directory, filename)
      await writeFile(path, capture.buffer, { mode: 0o600 })
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
