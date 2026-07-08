import { exec } from "node:child_process"
import { promisify } from "node:util"
import { readFile } from "node:fs/promises"

const execAsync = promisify(exec)

export type ShellResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export async function $(strings: TemplateStringsArray, ...values: unknown[]): Promise<ShellResult> {
  const command = buildCommand(strings, values)
  const { stdout, stderr } = await execAsync(command, {
    encoding: "utf8",
    timeout: 30000,
  })
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
}

export async function which(cmd: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${quote(cmd)}`, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export async function readTempFile(path: string): Promise<Buffer> {
  return readFile(path)
}

function buildCommand(strings: TemplateStringsArray, values: unknown[]): string {
  let result = ""
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) {
      result += quote(String(values[i]))
    }
  }
  return result.trim()
}

function quote(value: string): string {
  if (value === "") {
    return "''"
  }
  if (/^[a-zA-Z0-9_./:@,-]+$/.test(value)) {
    return value
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}
