import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let niche: string, language: string, visualStyle: string, tone: string;
  try {
    const body = await req.json();
    niche = body.niche || "motivational";
    language = body.language || "English";
    visualStyle = body.visual_style || "cinematic";
    tone = body.tone || "engaging";
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
      status: 200, // always 200 so Supabase SDK never throws FunctionsHttpError
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: "Server configuration error: missing API key" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are an elite short-form video script writer specialising in viral Instagram Reels and YouTube Shorts for faceless content channels.

Generate a high-quality, platform-optimised script for the following:
- Niche: ${niche}
- Language: ${language}
- Visual Style: ${visualStyle}
- Tone: ${tone}

⚠️ CRITICAL LANGUAGE RULE:
ALL script content — narration, on-screen text, captions, [VISUAL] descriptions, CTA — MUST be written ENTIRELY in ${language}.
If the language is "Malayalam", write all narration and text in Malayalam script (മലയാളം). Do NOT mix languages. Do NOT use any other language regardless of the niche topic.

SCRIPT STRUCTURE (mandatory):
1. HOOK (0–3 sec): Open with a shocking stat, bold claim, or intriguing question that stops the scroll. Must create instant curiosity or FOMO. Do NOT start with "Welcome" or greetings.
2. VALUE BODY (4–55 sec): Deliver 3–5 punchy, highly informative tips, facts, or steps. Each point should be concrete, actionable, and surprising. Use simple language. Every sentence earns its place.
3. CTA (last 5 sec): One clear, low-friction call to action — follow, save, comment a keyword, or watch next. Also in ${language}.

QUALITY RULES:
- Script should be 60–90 seconds when read aloud at a natural pace (~150–200 words)
- Zero filler words — every word is intentional
- SEO-aware: naturally weave in 2–3 trending keywords for the niche (in ${language})
- Trending framing: position content around current trends or timeless evergreen angles
- No references to showing a face or personal identity — fully faceless
- Include [VISUAL] scene markers that describe B-roll or on-screen text for each key point
- Pacing notes in brackets [PAUSE] [CUT] where appropriate for editing

VIDEO PROMPT RULES (for the video_prompt field — always write this in English for the AI video model):
- Write a single cinematic AI video generation prompt in English (under 200 words)
- Must include: aspect ratio (9:16), camera motion (e.g. slow dolly, handheld stabilised), visual style, colour grade, transition style, and mood
- Optimised for seamless Reels/Shorts — no jarring cuts, aesthetic B-roll, text-safe centre framing
- Specify: "smooth crossfade transitions", "consistent colour grade throughout", "no jump cuts", "30fps motion consistency"
- If language is Malayalam, include: "on-screen text and captions in Malayalam script"

Respond ONLY with valid JSON (no markdown code blocks):
{ "title": "...", "script": "...", "video_prompt": "...", "duration_estimate": 75, "hook": "...", "keywords": ["...", "...", "..."] }
All fields except "video_prompt" must be in ${language}.`;


  const upstream = await fetch(
    "https://app-cveo6hhr7n5t-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ success: false, error: `LLM error: ${upstream.status}` }), {
      status: 200, // always 200 so Supabase SDK never throws FunctionsHttpError
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const frame = JSON.parse(dataStr);
        const text = frame?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) fullText += text;
      } catch { /* skip incomplete */ }
    }
  }

  // Extract JSON from response
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return new Response(JSON.stringify({ success: false, error: "Failed to parse script response" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const scriptData = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({ success: true, data: scriptData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid script JSON from LLM" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
