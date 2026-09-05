import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"

export type ShellResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export async function run(command: string, args: string[]): Promise<ShellResult> {
  const { stdout, stderr, exitCode } = await spawnAsync(command, args)
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export async function which(cmd: string): Promise<boolean> {
  try {
    const result = await spawnAsync("command", ["-v", cmd], { timeout: 5000 })
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function readTempFile(path: string): Promise<Buffer> {
  return readFile(path)
}

export function isValidTempPath(path: string): boolean {
  return path.startsWith("/tmp/opencode-dc-")
}

type SpawnOptions = {
  timeout?: number
  input?: string
}

function spawnAsync(command: string, args: string[], options: SpawnOptions = {}): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: options.timeout,
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString("utf8")
    })

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString("utf8")
    })

    if (options.input !== undefined) {
      child.stdin?.write(options.input, "utf8")
      child.stdin?.end()
    }

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
  })
}
