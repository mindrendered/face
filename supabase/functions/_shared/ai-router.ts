import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ProviderConfig, ChatRequest, ChatResponse, StreamChunk, ProviderAdapter } from "./providers/base.ts";
import { DEFAULT_URLS } from "./providers/base.ts";
import { openaiAdapter } from "./providers/openai.ts";
import { anthropicAdapter } from "./providers/anthropic.ts";
import { googleAdapter } from "./providers/google.ts";
import { mistralAdapter } from "./providers/mistral.ts";
import { ollamaAdapter } from "./providers/ollama.ts";
import { customAdapter } from "./providers/custom.ts";
import { gatewayAdapter } from "./providers/gateway.ts";
import { cosmosAdapter } from "./providers/cosmos.ts";
import { nvidiaNimAdapter } from "./providers/nvidia_nim.ts";
import { openrouterAdapter } from "./providers/openrouter.ts";

// ── Adapter registry ────────────────────────────────────────────────────────

const adapters: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  mistral: mistralAdapter,
  ollama: ollamaAdapter,
  custom: customAdapter,
  cosmos: cosmosAdapter,
  nvidia_nim: nvidiaNimAdapter,
  openrouter: openrouterAdapter,
};

// ── Gateway (existing AppMedo gateway) fallback config ──────────────────────

const GATEWAY_PROVIDER: ProviderConfig = {
  name: "Gateway",
  provider: "google",
  api_key: Deno.env.get("INTEGRATIONS_API_KEY") ?? "",
  base_url: "https://app-cveo6hhr7n5t-api-VaOwP8E7dJqa.gateway.appmedo.com",
  model: "gemini-2.5-flash",
};

// NVIDIA NIM fallback — used when no user-configured provider exists
const NVIDIA_NIM_PROVIDER: ProviderConfig = {
  name: "NVIDIA NIM",
  provider: "nvidia_nim",
  api_key: Deno.env.get("NVIDIA_NIM_API_KEY") ?? "",
  base_url: "https://integrate.api.nvidia.com",
  model: "meta/llama-3.1-8b-instruct",
};

// ── Free provider fallbacks (no API key needed) ─────────────────────────────

const FREE_PROVIDERS: ProviderConfig[] = [
  {
    name: "OpenRouter (Nemotron Super)",
    provider: "openrouter",
    api_key: Deno.env.get("OPENROUTER_API_KEY") ?? null,
    base_url: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
  },
  {
    name: "OpenRouter (Gemma 4)",
    provider: "openrouter",
    api_key: Deno.env.get("OPENROUTER_API_KEY") ?? null,
    base_url: "https://openrouter.ai/api/v1",
    model: "google/gemma-4-31b-it:free",
  },
  {
    name: "OpenRouter (Nemotron Ultra)",
    provider: "openrouter",
    api_key: Deno.env.get("OPENROUTER_API_KEY") ?? null,
    base_url: "https://openrouter.ai/api/v1",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  },
];

// ── Usage logging ───────────────────────────────────────────────────────────

// Cost rates per 1K tokens (loaded from platform_settings at call time)
const COST_RATES: Record<string, { input: number; output: number }> = {
  openai: { input: 0.0025, output: 0.01 },
  anthropic: { input: 0.003, output: 0.015 },
  google: { input: 0.000125, output: 0.000375 },
  mistral: { input: 0.002, output: 0.006 },
  ollama: { input: 0, output: 0 },
  gateway: { input: 0.000125, output: 0.000375 },
  custom: { input: 0, output: 0 },
};

export async function logUsage(params: {
  userId: string;
  providerId: string | null;
  provider: string;
  model: string;
  useCase: UseCase;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}): Promise<void> {
  try {
    const rates = COST_RATES[params.provider] ?? COST_RATES.custom;
    const cost = (params.tokensIn / 1000) * rates.input + (params.tokensOut / 1000) * rates.output;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("ai_usage").insert({
      user_id: params.userId,
      provider_id: params.providerId,
      provider: params.provider,
      model: params.model,
      use_case: params.useCase,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      latency_ms: params.latencyMs,
      cost_estimate: cost,
      success: params.success,
      error_message: params.error || null,
    });
  } catch {
    // Non-critical — don't fail the request
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

export type UseCase = "script" | "llm" | "image";

/**
 * Resolve the best provider for a given use case.
 * 1. Query ai_providers table for user's active providers matching use_for
 * 2. Sort by priority (descending)
 * 3. Fall back to gateway if none found
 */
export async function resolveProvider(
  userId: string,
  useCase: UseCase,
  forceProvider?: string,
  forceModel?: string,
): Promise<{ config: ProviderConfig; adapter: ProviderAdapter }> {
  // If forced to a specific provider, use it directly
  if (forceProvider && forceProvider !== "gateway") {
    const adapter = adapters[forceProvider] ?? customAdapter;
    return {
      config: {
        name: forceProvider,
        provider: forceProvider,
        api_key: "", // caller must supply
        base_url: DEFAULT_URLS[forceProvider] ?? "",
        model: forceModel ?? "",
      },
      adapter,
    };
  }

  // Try to find a configured provider from the database
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: providers } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(10);

    if (providers && providers.length > 0) {
      // Filter by use_for
      const match = providers.find((p: Record<string, unknown>) => {
        const useFor = Array.isArray(p.use_for) ? p.use_for : [];
        return useFor.includes(useCase);
      });

      if (match) {
        const models = Array.isArray(match.models) ? match.models : [];
        const config: ProviderConfig = {
          name: match.name,
          provider: match.provider,
          api_key: match.api_key,
          base_url: match.base_url || DEFAULT_URLS[match.provider] || "",
          model: forceModel || models[0] || "",
        };
        const adapter = adapters[match.provider] ?? customAdapter;
        return { config, adapter };
      }
    }
  } catch {
    // Fall through to gateway
  }

  // Fallback chain: NVIDIA NIM → Free Providers → Gateway
  if (NVIDIA_NIM_PROVIDER.api_key) {
    return {
      config: { ...NVIDIA_NIM_PROVIDER, model: forceModel || NVIDIA_NIM_PROVIDER.model },
      adapter: nvidiaNimAdapter,
    };
  }

  // Try free providers (OpenRouter free models — no key needed for some)
  for (const freeProvider of FREE_PROVIDERS) {
    return {
      config: { ...freeProvider, model: forceModel || freeProvider.model },
      adapter: openrouterAdapter,
    };
  }

  // Default: use the gateway
  return {
    config: { ...GATEWAY_PROVIDER, model: forceModel || GATEWAY_PROVIDER.model },
    adapter: gatewayAdapter,
  };
}

/**
 * Non-streaming chat completion.
 */
export async function chatCompletion(
  userId: string,
  useCase: UseCase,
  messages: ChatRequest["messages"],
  options: { max_tokens?: number; temperature?: number; forceProvider?: string; forceModel?: string; providerId?: string } = {},
): Promise<ChatResponse & { provider: string; latency_ms: number }> {
  const { config, adapter } = await resolveProvider(userId, useCase, options.forceProvider, options.forceModel);
  const req: ChatRequest = {
    messages,
    max_tokens: options.max_tokens ?? 1024,
    temperature: options.temperature ?? 0.7,
    stream: false,
  };

  const { url, init } = adapter.buildRequest(config, req);
  const start = Date.now();
  const resp = await fetch(url, init);
  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logUsage({ userId, providerId: options.providerId ?? null, provider: config.provider, model: config.model, useCase, tokensIn: 0, tokensOut: 0, latencyMs: latency_ms, success: false, error: `HTTP ${resp.status}` });
    throw new Error(`${config.provider} API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const result = await adapter.parseResponse(resp);
  logUsage({ userId, providerId: options.providerId ?? null, provider: config.provider, model: config.model, useCase, tokensIn: result.usage?.input ?? 0, tokensOut: result.usage?.output ?? 0, latencyMs: latency_ms, success: true });
  return { ...result, provider: config.provider, latency_ms };
}

/**
 * Streaming chat completion — returns a ReadableStream of raw SSE lines
 * that the caller can pipe directly to the response.
 */
export async function chatCompletionStream(
  userId: string,
  useCase: UseCase,
  messages: ChatRequest["messages"],
  options: { max_tokens?: number; temperature?: number; forceProvider?: string; forceModel?: string; providerId?: string } = {},
): Promise<{ stream: ReadableStream; provider: string; config: ProviderConfig; adapter: ProviderAdapter; providerId: string | null; userId: string; useCase: UseCase; startTime: number }> {
  const { config, adapter } = await resolveProvider(userId, useCase, options.forceProvider, options.forceModel);
  const req: ChatRequest = {
    messages,
    max_tokens: options.max_tokens ?? 1024,
    temperature: options.temperature ?? 0.7,
    stream: true,
  };

  const { url, init } = adapter.buildStreamRequest(config, req);
  const startTime = Date.now();
  const resp = await fetch(url, init);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logUsage({ userId, providerId: options.providerId ?? null, provider: config.provider, model: config.model, useCase, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - startTime, success: false, error: `HTTP ${resp.status}` });
    throw new Error(`${config.provider} API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  if (!resp.body) {
    throw new Error(`${config.provider} returned no body`);
  }

  return { stream: resp.body, provider: config.provider, config, adapter, providerId: options.providerId ?? null, userId, useCase, startTime };
}

/**
 * Pipe a provider stream through SSE format to the client.
 * Handles both SSE (data: ...) and NDJSON (Ollama) formats.
 */
export function pipeStreamToResponse(
  stream: ReadableStream,
  adapter: ProviderAdapter,
  corsHeaders: Record<string, string>,
  logParams?: { userId: string; providerId: string | null; provider: string; model: string; useCase: UseCase; startTime: number },
): Response {
  const decoder = new TextDecoder("utf-8");
  let tokenCount = 0;

  const transform = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        // Try adapter's parser first
        const parsed = adapter.parseStreamLine(line);
        if (parsed) {
          if (parsed.done) {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          } else if (parsed.content) {
            tokenCount++;
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: parsed.content } }] })}\n\n`));
          }
          continue;
        }

        // Pass through raw SSE lines (for providers that already use SSE format)
        if (line.startsWith("data:")) {
          controller.enqueue(new TextEncoder().encode(line + "\n\n"));
        }
      }
    },

    async flush() {
      // Log usage after stream completes
      if (logParams) {
        logUsage({
          userId: logParams.userId,
          providerId: logParams.providerId,
          provider: logParams.provider,
          model: logParams.model,
          useCase: logParams.useCase,
          tokensIn: 0,
          tokensOut: tokenCount,
          latencyMs: Date.now() - logParams.startTime,
          success: true,
        });
      }
    },
  });

  const body = stream.pipeThrough(transform);

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
