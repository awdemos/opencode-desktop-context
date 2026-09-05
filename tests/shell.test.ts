import { describe, it, expect } from "bun:test"
import { run, which, readTempFile } from "../src/capture/shell"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("shell", () => {
  it("runs a simple command and returns stdout", async () => {
    const result = await run("echo", ["hello"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("hello")
    expect(result.stderr).toBe("")
  })

  it("does not execute shell metacharacters in arguments", async () => {
    const result = await run("echo", ["hello;", "world"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("hello; world")
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
})
