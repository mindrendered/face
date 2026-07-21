import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildRequest(provider: string, baseUrl: string, apiKey: string, model: string): { url: string; init: RequestInit } {
  const commonHeaders: Record<string, string> = { "Content-Type": "application/json" };

  switch (provider) {
    case "openai":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
        init: {
          method: "POST",
          headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "Say hi in 5 words" }], max_tokens: 20 }),
        },
      };
    case "anthropic":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1/messages`,
        init: {
          method: "POST",
          headers: { ...commonHeaders, "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens: 20, messages: [{ role: "user", content: "Say hi in 5 words" }] }),
        },
      };
    case "google":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1beta/models/${model}:generateContent?key=${apiKey}`,
        init: {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say hi in 5 words" }] }] }),
        },
      };
    case "mistral":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
        init: {
          method: "POST",
          headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "Say hi in 5 words" }], max_tokens: 20 }),
        },
      };
    case "ollama":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/api/chat`,
        init: {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify({ model, messages: [{ role: "user", content: "Say hi in 5 words" }], stream: false }),
        },
      };
    case "nvidia_nim":
    case "custom":
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
        init: {
          method: "POST",
          headers: { ...commonHeaders, Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "Say hi in 5 words" }], max_tokens: 20 }),
        },
      };
    case "cosmos":
      // Test connectivity to Cosmos server
      return {
        url: `${baseUrl.replace(/\/$/, "")}/v1/models`,
        init: {
          method: "GET",
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        },
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let provider: string, baseUrl: string, apiKey: string, model: string;
  try {
    const body = await req.json();
    provider = String(body.provider || "").toLowerCase();
    baseUrl = String(body.base_url || "").trim();
    apiKey = String(body.api_key || "").trim();
    model = String(body.model || "").trim();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!provider || !model) {
    return new Response(JSON.stringify({ success: false, error: "provider and model are required" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Ollama doesn't need an API key
  if (provider !== "ollama" && !apiKey) {
    return new Response(JSON.stringify({ success: false, error: "api_key is required for this provider" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Defaults
  if (!baseUrl) {
    switch (provider) {
      case "openai": baseUrl = "https://api.openai.com"; break;
      case "anthropic": baseUrl = "https://api.anthropic.com"; break;
      case "google": baseUrl = "https://generativelanguage.googleapis.com"; break;
      case "mistral": baseUrl = "https://api.mistral.ai"; break;
      case "ollama": baseUrl = "http://localhost:11434"; break;
      default: baseUrl = "";
    }
  }

  try {
    const { url, init } = buildRequest(provider, baseUrl, apiKey, model);
    const start = Date.now();
    const resp = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return new Response(JSON.stringify({
        success: false,
        error: `HTTP ${resp.status}: ${errText.slice(0, 300)}`,
        latency_ms: latencyMs,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({
      success: true,
      latency_ms: latencyMs,
      response_preview: JSON.stringify(data).slice(0, 200),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
