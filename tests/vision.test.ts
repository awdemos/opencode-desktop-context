import { describe, it, expect } from "bun:test"
import { createVisionClient } from "../src/vision"

describe("createVisionClient", () => {
  it("returns the model response on success", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434", model: "moondream" })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(init?.body as string)
      expect(body.model).toBe("moondream")
      expect(body.prompt).toBe("custom prompt")
      expect(body.images).toHaveLength(1)
      expect(body.stream).toBe(false)

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ response: "A terminal window" }),
      } as Response
    }

    try {
      const result = await client.describeImage(Buffer.from("fake"), "png", "custom prompt")
      expect(result).toBe("A terminal window")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("uses default prompt when none is provided", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434/", model: "moondream" })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(init?.body as string)
      expect(body.prompt).toBe("Describe this screenshot and transcribe any readable text.")

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ response: "ok" }),
      } as Response
    }

    try {
      await client.describeImage(Buffer.from("fake"), "jpeg")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("strips trailing slash from baseUrl", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434/", model: "moondream" })

    const originalFetch = globalThis.fetch
    let calledUrl: string | undefined
    globalThis.fetch = async (input, _init) => {
      calledUrl = input.toString()
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ response: "ok" }),
      } as Response
    }

    try {
      await client.describeImage(Buffer.from("fake"), "png")
      expect(calledUrl).toBe("http://localhost:11434/api/generate")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws on HTTP error", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434", model: "moondream" })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      } as Response)

    try {
      await expect(client.describeImage(Buffer.from("fake"), "png")).rejects.toThrow("Ollama vision request failed: 500")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws on API error field", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434", model: "moondream" })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ error: "model not found" }),
      } as Response)

    try {
      await expect(client.describeImage(Buffer.from("fake"), "png")).rejects.toThrow("Ollama vision error: model not found")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("throws when response field is missing", async () => {
    const client = createVisionClient({ baseUrl: "http://localhost:11434", model: "moondream" })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ done: true }),
      } as Response)

    try {
      await expect(client.describeImage(Buffer.from("fake"), "png")).rejects.toThrow("missing 'response' field")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
