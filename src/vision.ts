import { z } from "zod"

export type VisionClientOptions = {
  baseUrl: string
  model: string
  apiKey?: string
  allowRemoteVision?: boolean
}

export type VisionClient = {
  describeImage: (imageBuffer: Buffer, format: "png" | "jpeg", prompt?: string) => Promise<string>
}

const ollamaResponseSchema = z.object({
  response: z.string().optional(),
  error: z.string().optional(),
})

export function createVisionClient(options: VisionClientOptions): VisionClient {
  async function describeImage(
    imageBuffer: Buffer,
    format: "png" | "jpeg",
    prompt?: string,
  ): Promise<string> {
    const effectivePrompt = prompt ?? "Describe this screenshot and transcribe any readable text."
    const base = options.baseUrl.trim()
    const parsed = new URL(base)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Vision URL must use http/https, got ${parsed.protocol}`)
    }
    const host = parsed.hostname.toLowerCase()
    const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1"
    if (!isLoopback && !options.allowRemoteVision) {
      throw new Error(`Refusing to send screenshot to non-loopback vision URL: ${base}`)
    }
    const url = `${base.replace(/\/$/, "")}/api/generate`
    const body = {
      model: options.model,
      prompt: effectivePrompt,
      images: [imageBuffer.toString("base64")],
      stream: false,
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (options.apiKey) {
      headers["Authorization"] = `Bearer ${options.apiKey}`
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama vision request failed: ${response.status} ${response.statusText}`)
    }

    const result = ollamaResponseSchema.parse(await response.json())
    if (result.error) {
      throw new Error(`Ollama vision error: ${result.error}`)
    }
    if (typeof result.response !== "string") {
      throw new Error("Ollama vision response missing 'response' field")
    }
    return result.response
  }

  return { describeImage }
}
