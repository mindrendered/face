import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

// AppMedo gateway adapter — uses Gemini API format with gateway-specific auth header
export const gatewayAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    // Extract system prompt from messages if present
    const userMessages = req.messages.filter(m => m.role !== "system");
    const text = userMessages.map(m => m.content).join("\n\n");

    return {
      url: `${config.base_url}/v1beta/models/${config.model}:generateContent`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    const userMessages = req.messages.filter(m => m.role !== "system");
    const text = userMessages.map(m => m.content).join("\n\n");

    return {
      url: `${config.base_url}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
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
