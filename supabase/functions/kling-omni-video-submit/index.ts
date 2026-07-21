import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";

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

  // Verify JWT — reject unauthenticated requests
  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

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
  // Enrich the prompt with cinematic quality directives and trending styles.
  const rawPrompt = String(requestBody.prompt ?? "");

  // Detect if already enriched (check for multiple quality keywords)
  const qualityKeywords = ["crossfade", "colour grade", "motion-blur", "cinematic quality", "professional"];
  const qualityCount = qualityKeywords.filter(k => rawPrompt.toLowerCase().includes(k)).length;
  const alreadyEnriched = qualityCount >= 2;

  // Style presets based on visual_style hint from the prompt
  const promptLower = rawPrompt.toLowerCase();
  let styleEnrichment = "";

  if (promptLower.includes("neon") || promptLower.includes("futuristic") || promptLower.includes("cyber")) {
    styleEnrichment =
      "Neon-lit cyberpunk aesthetic: glowing edge highlights, electric cyan and magenta accent lighting, " +
      "holographic reflections on wet surfaces, futuristic HUD overlays, digital glitch micro-transitions.";
  } else if (promptLower.includes("dark") || promptLower.includes("moody") || promptLower.includes("dramatic")) {
    styleEnrichment =
      "Dark dramatic cinematography: deep crushed blacks, volumetric god rays, chiaroscuro lighting, " +
      "smoke/fog atmosphere, high contrast with selective colour pops, noir-inspired colour grade.";
  } else if (promptLower.includes("bright") || promptLower.includes("vibrant") || promptLower.includes("colorful")) {
    styleEnrichment =
      "Vibrant saturated palette: punchy complementary colours, bright directional lighting, " +
      "clean modern aesthetic, energetic motion graphics overlays, eye-catching colour transitions.";
  } else if (promptLower.includes("vintage") || promptLower.includes("retro") || promptLower.includes("film")) {
    styleEnrichment =
      "Vintage film emulation: warm amber tones, subtle grain texture, light leak overlays, " +
      "gentle vignette, Kodak Portra 400 colour science, analog feel with modern clarity.";
  } else if (promptLower.includes("minimal") || promptLower.includes("clean")) {
    styleEnrichment =
      "Ultra-clean minimalist aesthetic: generous negative space, soft diffused lighting, " +
      "muted pastel tones, elegant typography overlays, zen-like pacing, premium editorial feel.";
  } else {
    // Default: cinematic trending style
    styleEnrichment =
      "Premium cinematic look: rich colour grading with teal shadows and warm highlights, " +
      "shallow depth-of-field, lens flares, film-grade motion blur, professional colour science.";
  }

  const qualityDirectives = alreadyEnriched
    ? ""
    : `Cinematic quality: smooth camera motion (dolly, tracking, or crane), ` +
      `seamless crossfade transitions, consistent colour grade, ` +
      `no jump cuts, 30fps motion-blur consistency, ` +
      `text-safe centre framing, professional Reels/Shorts pacing. ` +
      styleEnrichment + ` ` +
      `Vibrant trending aesthetic: saturated highlights, deep shadows, ` +
      `dynamic lighting that moves with the camera, ` +
      `subtle particle effects or lens dust for depth, ` +
      `smooth ease-in-ease-out motion on all transitions.`;

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
