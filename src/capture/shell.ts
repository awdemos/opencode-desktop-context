import { spawn } from "node:child_process"
import { readFile, mkdtemp, rm, lstat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type ShellResult = {
  stdout: string
  stderr: string
  exitCode: number
}

function pushArg(args: string[], value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) pushArg(args, item)
  } else if (value !== undefined && value !== null) {
    args.push(String(value))
  }
}

function buildArgs(strings: TemplateStringsArray, values: unknown[]): string[] {
  const args: string[] = []
  for (let i = 0; i < strings.length; i++) {
    const parts = strings[i].split(/\s+/).filter((part) => part.length > 0)
    args.push(...parts)
    if (i < values.length) {
      pushArg(args, values[i])
    }
  }
  return args
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf-8")
    })
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf-8")
    })
    child.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 })
    })
  })
}

function runShell(command: string, timeoutMs: number): Promise<ShellResult> {
  return runProcess("sh", ["-c", command], timeoutMs)
}

function isShellMetacharacter(value: string): boolean {
  return /[;&|`$(){}[\]\*?#~!\n\r]/.test(value)
}

export async function $(strings: TemplateStringsArray, ...values: unknown[]): Promise<ShellResult> {
  const args = buildArgs(strings, values)
  if (args.length === 0) {
    return { stdout: "", stderr: "", exitCode: 0 }
  }
  const [command, ...commandArgs] = args
  for (const arg of commandArgs) {
    if (isShellMetacharacter(arg)) {
      throw new Error(`Refusing to pass shell metacharacters to subprocess: ${arg}`)
    }
    if (arg.startsWith("-")) {
      throw new Error(`Refusing to pass leading-dash argument to subprocess: ${arg}`)
    }
  }
  return runProcess(command, commandArgs, 30000)
}

const SAFE_SHELL_VALUE = /^[a-zA-Z0-9_+.,:@/%-]+$/

function quote(value: string): string {
  if (value === "") {
    return "''"
  }
  if (SAFE_SHELL_VALUE.test(value) && !value.startsWith("-")) {
    return value
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function which(cmd: string): Promise<boolean> {
  try {
    const result = await runShell(`command -v ${quote(cmd)}`, 5000)
    return result.exitCode === 0 && result.stdout.length > 0
  } catch {
    return false
  }
}

export async function readTempFile(path: string): Promise<Buffer> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Refusing to read non-regular temp file: ${path}`)
  }
  return readFile(path)
}

export async function createTempCaptureDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "opencode-dc-"))
}

export async function cleanupTempCaptureDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}
