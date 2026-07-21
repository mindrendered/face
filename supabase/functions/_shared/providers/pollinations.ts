// Pollinations.ai — Free image generation, no API key needed
// API: GET https://image.pollinations.ai/prompt/{encoded_prompt}?width=W&height=H&nologo=true
// Returns a JPEG/PNG image directly

export interface PollinationsImageRequest {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  enhance?: boolean;
}

export interface PollinationsImageResponse {
  url: string;
  width: number;
  height: number;
}

/**
 * Generate an image via Pollinations.ai (free, no key)
 */
export function buildPollinationsUrl(req: PollinationsImageRequest): string {
  const prompt = encodeURIComponent(req.prompt);
  const width = req.width ?? 576;  // 9:16 aspect for Reels/Shorts
  const height = req.height ?? 1024;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
  });
  if (req.seed) params.set("seed", String(req.seed));
  if (req.model) params.set("model", req.model);
  if (req.enhance) params.set("enhance", "true");
  return `https://image.pollinations.ai/prompt/${prompt}?${params.toString()}`;
}

/**
 * Generate image and return the URL (image is generated on-demand by Pollinations)
 */
export async function generateWithPollinations(req: PollinationsImageRequest): Promise<PollinationsImageResponse> {
  const url = buildPollinationsUrl(req);
  // Pollinations generates on-the-fly — just verify it's accessible
  const resp = await fetch(url, { method: "HEAD" });
  if (!resp.ok) {
    throw new Error(`Pollinations error: ${resp.status}`);
  }
  return { url, width: req.width ?? 576, height: req.height ?? 1024 };
}

// ── Free LLM providers (no API key needed) ─────────────────────────────────

export const FREE_LLM_PROVIDERS = [
  {
    name: "OpenRouter (free)",
    provider: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    api_key: null,  // Some free models don't need a key
  },
  {
    name: "OpenRouter (Gemma 4)",
    provider: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    model: "google/gemma-4-31b-it:free",
    api_key: null,
  },
  {
    name: "OpenRouter (Nemotron Ultra)",
    provider: "openrouter",
    base_url: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    api_key: null,
  },
];

export const FREE_IMAGE_PROVIDERS = [
  {
    name: "Pollinations.ai",
    provider: "pollinations",
    api_key: null,  // No key needed
  },
];
