import { z } from "zod"
import { homedir } from "node:os"
import { isAbsolute, relative, resolve, normalize } from "node:path"

export const captureTargetSchema = z.enum(["fullScreen", "activeWindow", "allDisplays"])
export const retentionSchema = z.enum(["memory", "temp", "persistent"])

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    const host = parsed.hostname.toLowerCase()
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
  } catch {
    return false
  }
}

function hasDotDotSegments(input: string): boolean {
  return normalize(input) !== resolve(input) || input.split(/[\\/]/).some((segment) => segment === "..")
}

function isWithinUserHome(dir: string): boolean {
  if (!isAbsolute(dir)) return false
  const home = homedir()
  const rel = relative(resolve(normalize(home)), resolve(normalize(dir)))
  return !rel.startsWith("..") && !isAbsolute(rel)
}

export const configSchema = z
  .object({
    captureTarget: captureTargetSchema.default("fullScreen"),
    maxAgeMs: z.number().int().min(0).default(30000),
    autoAttach: z.boolean().default(true),
    systemHint: z.boolean().default(false),
    visualIndicator: z.boolean().default(true),
    retention: retentionSchema.default("temp"),
    retentionTtlMs: z.number().int().min(0).default(600000),
    periodicCaptureMs: z.number().int().min(0).default(300000),
    visionModel: z.string().optional(),
    ollamaBaseUrl: z.string().url().default("http://127.0.0.1:11434"),
    allowRemoteVision: z.boolean().default(false),
    persistentDir: z.string().optional(),
    captureCooldownMs: z.number().int().min(0).default(1000),
    blocklist: z.array(z.string()).default(["1Password", "Bitwarden", "Chase", "Keychain Access"]),
    allowlist: z.array(z.string()).default([]),
    quality: z.number().int().min(1).max(100).default(80),
  })
  .refine(
    (data) => data.retention !== "persistent" || data.persistentDir,
    { message: "persistentDir is required when retention is 'persistent'", path: ["persistentDir"] },
  )
  .refine(
    (data) => !data.visionModel || isLoopbackUrl(data.ollamaBaseUrl) || data.allowRemoteVision,
    { message: "ollamaBaseUrl must use localhost/loopback unless allowRemoteVision is true", path: ["ollamaBaseUrl"] },
  )
  .refine(
    (data) => {
      if (data.retention !== "persistent" || !data.persistentDir) return true
      return isWithinUserHome(data.persistentDir) && !hasDotDotSegments(data.persistentDir)
    },
    { message: "persistentDir must be an absolute path within your home directory with no '..' segments", path: ["persistentDir"] },
  )

export type Config = z.infer<typeof configSchema>

export const defaultConfig = configSchema.parse({})

export function parseConfig(input: unknown): Config {
  return configSchema.parse(input)
}
