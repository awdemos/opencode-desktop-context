import { z } from "zod"

export type VisionClientOptions = {
  baseUrl: string
  model: string
  apiKey?: string
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
    const url = `${options.baseUrl.replace(/\/$/, "")}/api/generate`
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
