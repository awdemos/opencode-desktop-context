export type VisionClientOptions = {
  baseUrl: string
  model: string
}

export type VisionClient = {
  describeImage: (imageBuffer: Buffer, format: "png" | "jpeg", prompt?: string) => Promise<string>
}

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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama vision request failed: ${response.status} ${response.statusText}`)
    }

    const result = (await response.json()) as { response?: string; error?: string }
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
