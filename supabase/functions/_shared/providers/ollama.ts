import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

export const ollamaAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/api/chat`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages,
          stream: false,
          options: {
            num_predict: req.max_tokens ?? 1024,
            temperature: req.temperature ?? 0.7,
          },
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    return {
      url: `${config.base_url.replace(/\/$/, "")}/api/chat`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages: req.messages,
          stream: true,
          options: {
            num_predict: req.max_tokens ?? 1024,
            temperature: req.temperature ?? 0.7,
          },
        }),
      },
    };
  },

  async parseResponse(resp) {
    const data = await resp.json();
    return {
      content: data.message?.content ?? "",
      model: data.model ?? "",
      usage: data.eval_count ? { input: data.prompt_eval_count ?? 0, output: data.eval_count } : undefined,
    };
  },

  parseStreamLine(line: string): StreamChunk | null {
    // Ollama returns NDJSON (one JSON object per line), not SSE
    if (line.startsWith("data:")) return null; // skip SSE format
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      const data = JSON.parse(trimmed);
      if (data.done) return { content: "", done: true };
      const content = data.message?.content;
      if (content) return { content, done: false };
      return null;
    } catch {
      return null;
    }
  },
};
