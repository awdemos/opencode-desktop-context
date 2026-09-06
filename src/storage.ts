import { mkdir, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, isAbsolute, join, relative, resolve, normalize } from "node:path"
import type { StoredCapture } from "./capture/types.js"

export type StorageBackend = "memory" | "temp" | "persistent"

export type Storage = {
  save(capture: StoredCapture): Promise<StoredCapture>
  cleanup(ttlMs: number): Promise<void>
}

async function isWithinUserHome(dir: string): Promise<boolean> {
  if (!isAbsolute(dir)) return false
  const home = resolve(normalize(await realpathSafe(homedir())))
  const rel = relative(home, resolve(normalize(dir)))
  return !rel.startsWith("..") && !isAbsolute(rel)
}

function hasDotDotSegments(input: string): boolean {
  return normalize(input) !== resolve(input) || input.split(/[\\/]/).some((segment) => segment === "..")
}

async function resolveInputPath(input: string): Promise<string> {
  const { access, realpath } = await import("node:fs/promises")
  let prefix = resolve(normalize(input))
  let suffix = ""
  // Walk up until we find an existing prefix, then realpath it and append the non-existing suffix.
  while (prefix !== resolve(prefix, "..") && !(await exists(prefix))) {
    suffix = join(basename(prefix), suffix)
    prefix = resolve(prefix, "..")
  }
  const resolvedPrefix = await realpathSafe(prefix)
  return suffix ? resolve(normalize(join(resolvedPrefix, suffix))) : resolve(normalize(resolvedPrefix))
}

async function exists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises")
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function validatePersistentDir(directory: string): Promise<void> {
  if (!isAbsolute(directory)) {
    throw new Error("persistentDir must be an absolute path")
  }
  if (hasDotDotSegments(directory)) {
    throw new Error("persistentDir must not contain '..' segments")
  }
  const resolved = await resolveInputPath(directory)
  const home = resolve(normalize(await realpathSafe(homedir())))
  if (await isWithinUserHome(resolved)) {
    return
  }
  const workspaceRoot = getWorkspaceRoot()
  if (workspaceRoot && (await isWithin(resolved, workspaceRoot))) {
    return
  }
  throw new Error("persistentDir must be within the user home directory or an explicit workspace root")
}

async function realpathSafe(dir: string): Promise<string> {
  try {
    return await realpath(dir)
  } catch {
    return dir
  }
}

async function isWithin(child: string, parent: string): Promise<boolean> {
  const rel = relative(resolve(normalize(await realpathSafe(parent))), resolve(normalize(child)))
  return !rel.startsWith("..") && !isAbsolute(rel)
}

function getWorkspaceRoot(): string | undefined {
  const raw = process.env.OPENCODE_DESKTOP_CONTEXT_WORKSPACE_ROOT
  if (!raw) return undefined
  const resolved = resolve(normalize(raw))
  if (!isAbsolute(resolved)) return undefined
  return resolved
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

export async function createPersistentStorage(directory: string): Promise<Storage> {
  await validatePersistentDir(directory)
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

export async function createStorage(backend: StorageBackend, persistentDir?: string): Promise<Storage> {
  switch (backend) {
    case "persistent":
      if (!persistentDir) throw new Error("persistentDir required")
      return await createPersistentStorage(persistentDir)
    case "temp":
      return createTempStorage()
    case "memory":
    default:
      return createMemoryStorage()
  }
}
