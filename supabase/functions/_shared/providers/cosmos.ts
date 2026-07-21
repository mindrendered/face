import type { ProviderAdapter, ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from "./base.ts";

/**
 * NVIDIA Cosmos adapter — serves via vLLM-Omni with OpenAI-compatible API.
 *
 * Cosmos3 supports:
 * - POST /v1/images/generations (text-to-image)
 * - POST /v1/videos/sync (text-to-video, image-to-video, video-to-video)
 * - POST /v1/chat/completions (reasoner — text/vision understanding)
 *
 * This adapter handles the chat/reasoner interface via OpenAI-compatible endpoint.
 * For video generation, use the cosmosVideoGenerate() helper below.
 */

export const cosmosAdapter: ProviderAdapter = {
  buildRequest(config, req) {
    const messages = req.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: req.max_tokens ?? 2048,
          temperature: req.temperature ?? 0.7,
          stream: false,
        }),
      },
    };
  },

  buildStreamRequest(config, req) {
    const messages = req.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    return {
      url: `${config.base_url.replace(/\/$/, "")}/v1/chat/completions`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          max_tokens: req.max_tokens ?? 2048,
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
      const content = data.choices?.[0]?.delta?.content;
      if (content) return { content, done: false };
      return null;
    } catch {
      return null;
    }
  },
};

// ── Cosmos Video Generation (synchronous) ───────────────────────────────────

export interface CosmosVideoRequest {
  prompt: string;
  negative_prompt?: string;
  image_url?: string; // for image-to-video
  size?: string; // e.g. "1280x720"
  num_frames?: number;
  fps?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  flow_shift?: number;
  seed?: number;
  enable_sound?: boolean;
  guardrails?: boolean;
}

export interface CosmosVideoResponse {
  success: boolean;
  video_base64?: string;
  error?: string;
  latency_ms?: number;
}

/**
 * Generate video synchronously via Cosmos vLLM-Omni /v1/videos/sync endpoint.
 * Returns base64-encoded MP4 on success.
 */
export async function cosmosVideoGenerate(
  baseUrl: string,
  apiKey: string | null,
  request: CosmosVideoRequest,
): Promise<CosmosVideoResponse> {
  const start = Date.now();

  const form = new FormData();
  form.append("prompt", request.prompt);
  if (request.negative_prompt) form.append("negative_prompt", request.negative_prompt);
  if (request.size) form.append("size", request.size);
  if (request.num_frames) form.append("num_frames", String(request.num_frames));
  if (request.fps) form.append("fps", String(request.fps));
  if (request.num_inference_steps) form.append("num_inference_steps", String(request.num_inference_steps));
  if (request.guidance_scale) form.append("guidance_scale", String(request.guidance_scale));
  if (request.flow_shift) form.append("flow_shift", String(request.flow_shift));
  if (request.seed !== undefined) form.append("seed", String(request.seed));

  const extraParams: Record<string, unknown> = {
    use_resolution_template: false,
    use_duration_template: false,
    guardrails: request.guardrails ?? true,
  };
  form.append("extra_params", JSON.stringify(extraParams));

  // If image provided, fetch and attach
  if (request.image_url) {
    try {
      const imgResp = await fetch(request.image_url);
      const blob = await imgResp.blob();
      form.append("input_reference", blob, "condition.png");
    } catch {
      // Skip image if fetch fails
    }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/videos/sync`, {
    method: "POST",
    headers,
    body: form,
  });

  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { success: false, error: `Cosmos API error ${resp.status}: ${errText.slice(0, 300)}`, latency_ms };
  }

  // Response is raw MP4 bytes
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("video") || contentType.includes("octet-stream")) {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { success: true, video_base64: base64, latency_ms };
  }

  // Try JSON response (some implementations return JSON with base64)
  try {
    const data = await resp.json();
    return {
      success: true,
      video_base64: data.b64_video || data.video || data.data?.[0]?.b64_json,
      latency_ms,
    };
  } catch {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { success: true, video_base64: base64, latency_ms };
  }
}

// ── Cosmos Image Generation ─────────────────────────────────────────────────

export interface CosmosImageRequest {
  prompt: string;
  negative_prompt?: string;
  size?: string; // e.g. "1280x720"
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
}

/**
 * Generate image via Cosmos /v1/images/generations endpoint.
 */
export async function cosmosImageGenerate(
  baseUrl: string,
  apiKey: string | null,
  request: CosmosImageRequest,
): Promise<{ success: boolean; image_base64?: string; error?: string; latency_ms?: number }> {
  const start = Date.now();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body: Record<string, unknown> = {
    prompt: request.prompt,
    size: request.size || "1280x720",
    num_inference_steps: request.num_inference_steps ?? 35,
    guidance_scale: request.guidance_scale ?? 6.0,
    seed: request.seed ?? 0,
    extra_params: {
      use_resolution_template: false,
      guardrails: true,
    },
  };
  if (request.negative_prompt) body.negative_prompt = request.negative_prompt;

  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { success: false, error: `Cosmos API error ${resp.status}: ${errText.slice(0, 300)}`, latency_ms };
  }

  const data = await resp.json();
  const image = data.data?.[0]?.b64_json || data.data?.[0]?.url;
  return { success: true, image_base64: image, latency_ms };
}
