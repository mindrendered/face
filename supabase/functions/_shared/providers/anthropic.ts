import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

export const anthropicAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    // Anthropic puts system prompt as a top-level param, not in messages
    const systemMsg = req.messages.find(m => m.role === "system");
    const messages = req.messages.filter(m => m.role !== "system");

    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/messages`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.api_key!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: req.max_tokens ?? 1024,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages,
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    const systemMsg = req.messages.find(m => m.role === "system");
    const messages = req.messages.filter(m => m.role !== "system");

    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/messages`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.api_key!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: req.max_tokens ?? 1024,
          stream: true,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages,
        }),
      },
    };
  },

  async parseResponse(resp) {
    const data = await resp.json();
    const text = data.content?.map((c: { text?: string }) => c.text).join("") ?? "";
    return {
      content: text,
      model: data.model ?? "",
      usage: data.usage ? { input: data.usage.input_tokens, output: data.usage.output_tokens } : undefined,
    };
  },

  parseStreamLine(line) {
    if (!line.startsWith("data:")) return null;
    const dataStr = line.slice(5).trim();
    if (!dataStr) return null;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === "content_block_delta") {
        return { content: data.delta?.text ?? "", done: false };
      }
      if (data.type === "message_stop") {
        return { content: "", done: true };
      }
      return null;
    } catch {
      return null;
    }
  },
};
