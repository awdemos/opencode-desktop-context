import { describe, it, expect } from "bun:test"
import { $, which, readTempFile, createTempCaptureDir, cleanupTempCaptureDir } from "../src/capture/shell"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("shell", () => {
  it("runs a simple command and returns stdout", async () => {
    const result = await $`echo hello`
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("hello")
    expect(result.stderr).toBe("")
  })

  it("quotes interpolated values safely", async () => {
    const value = "hello world"
    const result = await $`echo ${value}`
    expect(result.stdout).toBe("hello world")
  })

  it("does not treat leading dash values as flags", async () => {
    // A value starting with - should be passed as a single positional argument,
    // not interpreted as a flag by the invoked binary.
    const value = "-n"
    const result = await $`printf %s ${value}`
    expect(result.stdout).toBe("-n")
  })

  it("which finds an existing command", async () => {
    expect(await which("echo")).toBe(true)
  })

  it("which returns false for a nonexistent command", async () => {
    expect(await which("definitely-not-a-real-command-12345")).toBe(false)
  })

  it("readTempFile returns file contents", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shell-test-"))
    const path = join(dir, "test.bin")
    await writeFile(path, Buffer.from([0, 1, 2, 3]))
    const result = await readTempFile(path)
    expect(result).toEqual(Buffer.from([0, 1, 2, 3]))
    await rm(dir, { recursive: true, force: true })
  })

  it("createTempCaptureDir creates a private directory under tmpdir", async () => {
    const dir = await createTempCaptureDir()
    expect(dir.startsWith(tmpdir())).toBe(true)
    await cleanupTempCaptureDir(dir)
  })

  it("cleanupTempCaptureDir removes the directory", async () => {
    const dir = await createTempCaptureDir()
    const file = join(dir, "file.txt")
    await writeFile(file, "data")
    await cleanupTempCaptureDir(dir)
    await expect(readFile(file)).rejects.toThrow()
  })
})
