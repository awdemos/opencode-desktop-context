import { describe, it, expect } from "bun:test"
import { $, which, readTempFile, createTempCaptureDir, cleanupTempCaptureDir } from "../src/capture/shell"
import { mkdtemp, writeFile, rm, readFile, symlink } from "node:fs/promises"
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

  it("rejects leading dash values as unsafe", async () => {
    const value = "-n"
    await expect($`printf %s ${value}`).rejects.toThrow("leading-dash")
  })

  it("rejects shell metacharacters in interpolated values", async () => {
    const value = "foo; echo bar"
    await expect($`printf %s ${value}`).rejects.toThrow("shell metacharacters")
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

  it("readTempFile refuses to read non-regular files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "shell-test-"))
    const link = join(dir, "link")
    const target = join(dir, "target")
    await writeFile(target, "target")
    await symlink(target, link)
    await expect(readTempFile(link)).rejects.toThrow("non-regular")
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
