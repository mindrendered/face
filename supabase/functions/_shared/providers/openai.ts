import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

export const openaiAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages,
          max_tokens: req.max_tokens ?? 1024,
          temperature: req.temperature ?? 0.7,
          stream: false,
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages,
          max_tokens: req.max_tokens ?? 1024,
          temperature: req.temperature ?? 0.7,
          stream: true,
        }),
      },
    };
  },

  async parseResponse(resp) {
    const data = await resp.json();
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model: data.model ?? "",
      usage: data.usage ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens } : undefined,
    };
  },

  parseStreamLine(line) {
    if (!line.startsWith("data:")) return null;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return { content: "", done: true };
    try {
      const data = JSON.parse(dataStr);
      const content = data.choices?.[0]?.delta?.content;
      if (content) return { content, done: false };
      return null;
    } catch {
      return null;
    }
  },
};
