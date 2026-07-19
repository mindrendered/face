import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

const err = (message: string) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status: 200, // always 200 so Supabase SDK never throws FunctionsHttpError
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

  let requestBody: Record<string, unknown>;
  try {
    requestBody = await req.json();
    if (!requestBody.multi_shot && !requestBody.prompt) {
      throw new Error("Missing prompt (required for single-shot mode)");
    }
    if (requestBody.multi_shot && !requestBody.multi_prompt) {
      throw new Error("Missing multi_prompt (required for multi-shot mode)");
    }
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) return err("Server configuration error: missing API key");

  // ── Quality enrichment ────────────────────────────────────────────────────
  // Append cinematic quality directives to the prompt unless the caller already
  // includes them (detected by presence of key phrases).
  const rawPrompt = String(requestBody.prompt ?? "");
  const qualityDirectives =
    "Cinematic quality: smooth dolly or handheld-stabilised camera motion, " +
    "seamless crossfade transitions between every shot, consistent colour grade throughout, " +
    "no jump cuts, 30 fps motion-blur consistency, aesthetic B-roll, " +
    "text-safe centre framing, professional Reels/Shorts pacing.";
  const alreadyEnriched =
    rawPrompt.includes("crossfade") ||
    rawPrompt.includes("colour grade") ||
    rawPrompt.includes("motion-blur");
  const enrichedPrompt = alreadyEnriched
    ? rawPrompt
    : `${rawPrompt.trimEnd()}. ${qualityDirectives}`;

  // Build the enriched payload — caller-supplied fields take precedence.
  // duration is clamped to API-valid values: 5 or 10 (API rejects all others incl. 15)
  const rawDuration = String(requestBody.duration ?? "5");
  const validDuration = rawDuration === "10" ? "10" : "5";

  const enrichedBody: Record<string, unknown> = {
    aspect_ratio: "9:16",     // default for Reels/Shorts; caller can override
    ...requestBody,
    prompt: enrichedPrompt,
    duration: validDuration,
    // Style and motion parameters (only set if not already provided by caller)
    ...(requestBody.camera_motion == null && { camera_motion: "smooth_motion" }),
    ...(requestBody.style == null && { style: "cinematic" }),
  };

  let upstream: Response;
  try {
    upstream = await fetch(
      "https://app-cveo6hhr7n5t-api-k93RvqRrRZba.gateway.appmedo.com/v1/videos/omni-video",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(enrichedBody),
      }
    );
  } catch (fetchErr) {
    return err(`Network error: ${(fetchErr as Error).message}`);
  }

  if (upstream.status === 429) return err("Quota exceeded — please try again later");
  if (upstream.status === 402) return err("Insufficient balance");
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => upstream.status.toString());
    return err(`Upstream error ${upstream.status}: ${body}`);
  }

  const data = await upstream.json();
  return ok(data);
});
