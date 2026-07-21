import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

// OpenRouter is OpenAI-compatible — uses the same request/response format
// Free models available with :free suffix (no API key needed for some)
export const openrouterAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: req.max_tokens ?? 1024,
          temperature: req.temperature ?? 0.7,
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: req.max_tokens ?? 1024,
          temperature: req.temperature ?? 0.7,
          stream: true,
        }),
      },
    };
  },

  async parseResponse(resp) {
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      content: text,
      model: data.model ?? "",
      usage: data.usage
        ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  },

  parseStreamLine(line) {
    if (!line.startsWith("data:")) return null;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return { content: "", done: true };
    try {
      const data = JSON.parse(dataStr);
      const text = data.choices?.[0]?.delta?.content;
      if (text) return { content: text, done: false };
      return null;
    } catch {
      return null;
    }
  },
};
