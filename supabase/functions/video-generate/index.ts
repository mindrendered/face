import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const err = (message: string, status = 200) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Provider interfaces ──────────────────────────────────────────────────────

interface VideoRequest {
  prompt: string;
  negative_prompt?: string;
  image_url?: string;
  aspect_ratio?: string;
  duration?: string;
  num_frames?: number;
  fps?: number;
  model?: string;
  provider?: string;
  seed?: number;
}

interface VideoResponse {
  success: boolean;
  task_id?: string;
  status?: string;
  video_url?: string;
  video_base64?: string;
  error?: string;
  latency_ms?: number;
  provider?: string;
}

// ── Kling provider ───────────────────────────────────────────────────────────

async function klingSubmit(
  apiKey: string,
  request: VideoRequest,
): Promise<VideoResponse> {
  const start = Date.now();

  // Enrich prompt with cinematic quality
  const enrichedPrompt = `${request.prompt}. Cinematic quality: smooth camera motion, seamless crossfade transitions, consistent colour grade, professional Reels/Shorts pacing, vibrant trending aesthetic.`;

  const body: Record<string, unknown> = {
    prompt: enrichedPrompt,
    aspect_ratio: request.aspect_ratio || "9:16",
    duration: request.duration || "5",
    camera_motion: "smooth_motion",
    style: "cinematic",
  };

  if (request.negative_prompt) body.negative_prompt = request.negative_prompt;
  if (request.seed) body.seed = request.seed;

  const resp = await fetch(
    "https://app-cveo6hhr7n5t-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { success: false, error: `Kling API error ${resp.status}: ${errText.slice(0, 300)}`, latency_ms, provider: "kling" };
  }

  const data = await resp.json();
  return {
    success: true,
    task_id: data.data?.task_id,
    status: data.data?.task_status || "submitted",
    latency_ms,
    provider: "kling",
  };
}

async function klingQuery(
  apiKey: string,
  taskId: string,
): Promise<VideoResponse> {
  const start = Date.now();

  const resp = await fetch(
    `https://app-cveo6hhr7n5t-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { success: false, error: `Kling API error ${resp.status}: ${errText.slice(0, 300)}`, latency_ms, provider: "kling" };
  }

  const data = await resp.json();
  if (data.code !== 0) {
    return { success: false, error: `Kling API error ${data.code}: ${data.message}`, latency_ms, provider: "kling" };
  }

  const taskData = data.data;
  return {
    success: true,
    task_id: taskId,
    status: taskData.task_status,
    video_url: taskData.task_result?.videos?.[0]?.url,
    latency_ms,
    provider: "kling",
  };
}

// ── Cosmos provider (inline) ─────────────────────────────────────────────────

async function cosmosSubmit(
  baseUrl: string,
  apiKey: string | null,
  request: VideoRequest,
): Promise<VideoResponse> {
  const start = Date.now();

  const form = new FormData();
  form.append("prompt", request.prompt);
  if (request.negative_prompt) form.append("negative_prompt", request.negative_prompt);
  form.append("size", request.aspect_ratio === "9:16" ? "720x1280" : "1280x720");
  form.append("num_frames", String(request.num_frames || 189));
  form.append("fps", String(request.fps || 24));
  form.append("num_inference_steps", "35");
  form.append("guidance_scale", "6.0");
  form.append("flow_shift", "10.0");
  form.append("seed", String(request.seed || Math.floor(Math.random() * 10000)));
  form.append("extra_params", JSON.stringify({
    use_resolution_template: false,
    use_duration_template: false,
    guardrails: false,
  }));

  if (request.image_url) {
    try {
      const imgResp = await fetch(request.image_url);
      const blob = await imgResp.blob();
      form.append("input_reference", blob, "condition.png");
    } catch { /* skip */ }
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
    return { success: false, error: `Cosmos API error ${resp.status}: ${errText.slice(0, 300)}`, latency_ms, provider: "cosmos" };
  }

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("video") || contentType.includes("octet-stream")) {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { success: true, video_base64: base64, status: "completed", latency_ms, provider: "cosmos" };
  }

  try {
    const data = await resp.json();
    return {
      success: true,
      video_base64: data.b64_video || data.video || data.data?.[0]?.b64_json,
      status: "completed",
      latency_ms,
      provider: "cosmos",
    };
  } catch {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { success: true, video_base64: base64, status: "completed", latency_ms, provider: "cosmos" };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed");

  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let request: VideoRequest;
  let action: string;
  let taskId: string | undefined;

  try {
    const body = await req.json();
    action = body.action || "submit";
    taskId = body.task_id;
    request = {
      prompt: String(body.prompt || ""),
      negative_prompt: body.negative_prompt ? String(body.negative_prompt) : undefined,
      image_url: body.image_url ? String(body.image_url) : undefined,
      aspect_ratio: body.aspect_ratio ? String(body.aspect_ratio) : "9:16",
      duration: body.duration ? String(body.duration) : "5",
      num_frames: body.num_frames ? Number(body.num_frames) : undefined,
      fps: body.fps ? Number(body.fps) : undefined,
      model: body.model ? String(body.model) : undefined,
      provider: body.provider ? String(body.provider) : undefined,
      seed: body.seed !== undefined ? Number(body.seed) : undefined,
    };
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  // Resolve provider
  let provider = request.provider || "kling";
  let apiKey: string | null = null;
  let cosmosUrl = "http://localhost:8000";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check for configured video provider
    const { data: providers } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .contains("use_for", JSON.stringify(["video"]))
      .order("priority", { ascending: false })
      .limit(5);

    if (providers && providers.length > 0) {
      const videoProvider = providers.find((p: Record<string, unknown>) => p.provider === provider);
      if (videoProvider) {
        apiKey = videoProvider.api_key as string || null;
        if (videoProvider.base_url) cosmosUrl = videoProvider.base_url as string;
      }
    }
  } catch { /* use defaults */ }

  // Fallback to env vars
  if (!apiKey) {
    if (provider === "kling") {
      apiKey = Deno.env.get("INTEGRATIONS_API_KEY") || null;
    } else if (provider === "cosmos") {
      apiKey = Deno.env.get("COSMOS_API_KEY") || null;
    }
  }

  // Handle query action
  if (action === "query") {
    if (!taskId) return err("task_id is required for query action");
    if (!apiKey) return err(`No API key configured for ${provider}`);

    if (provider === "kling") {
      const result = await klingQuery(apiKey, taskId);
      return ok(result);
    }
    return err(`Query not supported for provider: ${provider}`);
  }

  // Handle submit action
  if (!request.prompt) return err("prompt is required");

  // Try provider, fallback to others
  const providers = [provider, "kling", "cosmos"];
  const errors: string[] = [];

  for (const p of providers) {
    try {
      if (p === "kling") {
        const key = apiKey || Deno.env.get("INTEGRATIONS_API_KEY");
        if (!key) { errors.push("kling: no API key"); continue; }
        const result = await klingSubmit(key, request);
        if (result.success) return ok(result);
        errors.push(`kling: ${result.error}`);
      } else if (p === "cosmos") {
        const url = cosmosUrl;
        const key = apiKey || Deno.env.get("COSMOS_API_KEY");
        const result = await cosmosSubmit(url, key, request);
        if (result.success) return ok(result);
        errors.push(`cosmos: ${result.error}`);
      }
    } catch (e) {
      errors.push(`${p}: ${(e as Error).message}`);
    }
  }

  return err(`All providers failed: ${errors.join("; ")}`);
});
