import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

function messagesToContents(messages: ChatRequest["messages"]): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      // Google uses a "user" message for system instructions
      contents.push({ role: "user", parts: [{ text: msg.content }] });
    } else {
      contents.push({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] });
    }
  }
  return contents;
}

export const googleAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1beta/models/${config.model}:generateContent?key=${config.api_key}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messagesToContents(req.messages),
          generationConfig: {
            maxOutputTokens: req.max_tokens ?? 1024,
            temperature: req.temperature ?? 0.7,
          },
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.api_key}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messagesToContents(req.messages),
          generationConfig: {
            maxOutputTokens: req.max_tokens ?? 1024,
            temperature: req.temperature ?? 0.7,
          },
        }),
      },
    };
  },

  async parseResponse(resp) {
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
    return {
      content: text,
      model: data.modelVersion ?? "",
      usage: data.usageMetadata
        ? { input: data.usageMetadata.promptTokenCount ?? 0, output: data.usageMetadata.candidatesTokenCount ?? 0 }
        : undefined,
    };
  },

  parseStreamLine(line) {
    if (!line.startsWith("data:")) return null;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return { content: "", done: true };
    try {
      const data = JSON.parse(dataStr);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { content: text, done: false };
      return null;
    } catch {
      return null;
    }
  },
};
