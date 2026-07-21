import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const err = (message: string) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed");

  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let prompt: string, negativePrompt: string | undefined, imageUrl: string | undefined;
  let size: string, numFrames: number, fps: number, numInferenceSteps: number;
  let guidanceScale: number, flowShift: number, seed: number, enableSound: boolean, guardrails: boolean;

  try {
    const body = await req.json();
    prompt = String(body.prompt || "");
    negativePrompt = body.negative_prompt ? String(body.negative_prompt) : undefined;
    imageUrl = body.image_url ? String(body.image_url) : undefined;
    size = body.size ? String(body.size) : "1280x720";
    numFrames = body.num_frames ? Number(body.num_frames) : 189;
    fps = body.fps ? Number(body.fps) : 24;
    numInferenceSteps = body.num_inference_steps ? Number(body.num_inference_steps) : 35;
    guidanceScale = body.guidance_scale ? Number(body.guidance_scale) : 6.0;
    flowShift = body.flow_shift ? Number(body.flow_shift) : 10.0;
    seed = body.seed !== undefined ? Number(body.seed) : Math.floor(Math.random() * 10000);
    enableSound = body.enable_sound ?? false;
    guardrails = body.guardrails ?? false;
    if (!prompt) return err("prompt is required");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  // Resolve Cosmos server URL from ai_providers or defaults
  let cosmosUrl = "http://localhost:8000";
  let cosmosKey: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: providers } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "cosmos")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(1);
    if (providers && providers.length > 0) {
      cosmosUrl = providers[0].base_url || cosmosUrl;
      cosmosKey = providers[0].api_key || null;
    }
  } catch { /* use defaults */ }

  if (!cosmosKey) cosmosKey = Deno.env.get("COSMOS_API_KEY") || null;

  // Build form data for Cosmos /v1/videos/sync
  const start = Date.now();
  const form = new FormData();
  form.append("prompt", prompt);
  if (negativePrompt) form.append("negative_prompt", negativePrompt);
  form.append("size", size);
  form.append("num_frames", String(numFrames));
  form.append("fps", String(fps));
  form.append("num_inference_steps", String(numInferenceSteps));
  form.append("guidance_scale", String(guidanceScale));
  form.append("flow_shift", String(flowShift));
  form.append("seed", String(seed));
  form.append("extra_params", JSON.stringify({
    use_resolution_template: false,
    use_duration_template: false,
    guardrails,
  }));

  if (imageUrl) {
    try {
      const imgResp = await fetch(imageUrl);
      const blob = await imgResp.blob();
      form.append("input_reference", blob, "condition.png");
    } catch { /* skip */ }
  }

  const headers: Record<string, string> = {};
  if (cosmosKey) headers["Authorization"] = `Bearer ${cosmosKey}`;

  let resp: Response;
  try {
    resp = await fetch(`${cosmosUrl.replace(/\/$/, "")}/v1/videos/sync`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch (fetchErr) {
    return err(`Cannot reach Cosmos server at ${cosmosUrl}: ${(fetchErr as Error).message}`);
  }

  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return err(`Cosmos API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("video") || contentType.includes("octet-stream")) {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return ok({ success: true, video_base64: base64, latency_ms });
  }

  try {
    const data = await resp.json();
    return ok({ success: true, video_base64: data.b64_video || data.video || data.data?.[0]?.b64_json, latency_ms });
  } catch {
    const buffer = await resp.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return ok({ success: true, video_base64: base64, latency_ms });
  }
});
