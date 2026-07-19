import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";

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

  // Verify JWT — reject unauthenticated requests
  const user = await verifyAuth(req);
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let niche: string, language: string, visualStyle: string, tone: string;
  try {
    const body = await req.json();
    niche = String(body.niche || "motivational").slice(0, 100);
    language = String(body.language || "English").slice(0, 50);
    visualStyle = String(body.visual_style || "cinematic").slice(0, 50);
    tone = String(body.tone || "engaging").slice(0, 50);
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid request body" }), {
      status: 200, // always 200 so Supabase SDK never throws FunctionsHttpError
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Reject inputs containing prompt-injection patterns
  const suspectPattern = /ignore (all|previous|above)|system prompt|you are now|disregard/i;
  if (suspectPattern.test(niche) || suspectPattern.test(language) || suspectPattern.test(visualStyle) || suspectPattern.test(tone)) {
    return new Response(JSON.stringify({ success: false, error: "Invalid input" }), {
      status: 200,
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

  const systemPrompt = `You are the world's best viral short-form video scriptwriter. You create scripts that consistently hit 1M+ views on Instagram Reels and YouTube Shorts. You understand platform algorithms, trending formats, and psychological hooks better than anyone.

Generate a script for:
- Niche: ${niche}
- Language: ${language}
- Visual Style: ${visualStyle}
- Tone: ${tone}

⚠️ CRITICAL LANGUAGE RULE:
ALL script content — narration, on-screen text, captions, [VISUAL] descriptions, CTA — MUST be written ENTIRELY in ${language}.
If the language is "Malayalam", write all narration and text in Malayalam script (മലയാളം). Do NOT mix languages.

═══ SCRIPT STRUCTURE ═══

Hook (0–2 sec) — THE MOST IMPORTANT PART:
- Use ONE of these proven hook formulas:
  • "Stop scrolling. [Shocking fact]..."
  • "You've been lied to about [topic]..."
  * "[Number] things nobody tells you about [topic]..."
  • "I can't believe this actually works..."
  • "POV: You just discovered [mind-blowing thing]..."
- Create instant pattern interrupt — the viewer MUST stop
- Never start with "Welcome", "Hey guys", or greetings

Value Body (3–55 sec) — RETENTION ENGINE:
- Deliver exactly 3–7 punchy points (tips, facts, steps, secrets)
- Each point: 1 sentence setup + 1 sentence payoff
- Use power words: "secret", "actually", "shocking", "nobody talks about", "here's the thing"
- Create micro-hooks between points: "But wait, this next one changes everything..."
- Every sentence must earn its place — zero filler

CTA (last 3–5 sec) — CONVERSION:
- One specific action: "Follow for Part 2", "Comment [keyword]", "Save this before it's gone"
- Create urgency: "You'll regret not knowing this", "Share before this gets taken down"

═══ VIRAL OPTIMIZATION ═══

- Script: 60–90 seconds when read aloud (~150–220 words)
- Include 2–3 trending search keywords naturally woven in
- Position around current trends OR timeless evergreen angles
- Fully faceless — no references to showing face or personal identity
- Include [VISUAL] markers: "[VISUAL: Bold text overlay]", "[VISUAL: B-roll of X]"
- Include pacing markers: [PAUSE 0.5s] [QUICK CUT] [SLOW MOTION]
- Add on-screen text suggestions: [TEXT ON SCREEN: "keyword"]

═══ VIDEO PROMPT (for AI video model — ALWAYS English) ═══

Write a single cinematic prompt (under 250 words) that includes:
- Platform: 9:16 vertical for Reels/Shorts
- Camera: specific motion (slow dolly, tracking shot, crane up, handheld stabilised)
- Lighting: dramatic rim lighting, golden hour backlighting, neon glow, volumetric fog
- Color grade: specific palette (teal & orange, cyberpunk neon, desaturated film, rich warm tones)
- Motion: 30fps consistency, smooth crossfade transitions, no jump cuts
- Composition: text-safe centre framing, rule of thirds, depth of field
- Style keywords: cinematic, professional, premium, trending
- If Malayalam: include "on-screen text and captions in Malayalam script"

═══ OUTPUT FORMAT ═══

Respond ONLY with valid JSON (no markdown code blocks):
{
  "title": "catchy, curiosity-driven title (max 60 chars)",
  "script": "full narration script with [VISUAL] and [PAUSE] markers",
  "video_prompt": "cinematic AI video generation prompt in English",
  "duration_estimate": 75,
  "hook": "the opening hook line",
  "keywords": ["trending keyword 1", "keyword 2", "keyword 3"]
}
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

  // Extract JSON from response — try multiple strategies
  let scriptData: Record<string, unknown> | null = null;

  // Strategy 1: Direct JSON match
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { scriptData = JSON.parse(jsonMatch[0]); } catch { /* try next strategy */ }
  }

  // Strategy 2: Find JSON between ``` markers
  if (!scriptData) {
    const fenced = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenced) {
      try { scriptData = JSON.parse(fenced[1]); } catch { /* try next strategy */ }
    }
  }

  // Strategy 3: Greedy extraction — find the outermost { ... } with balanced braces
  if (!scriptData) {
    const start = fullText.indexOf('{');
    if (start !== -1) {
      let depth = 0;
      for (let i = start; i < fullText.length; i++) {
        if (fullText[i] === '{') depth++;
        if (fullText[i] === '}') depth--;
        if (depth === 0) {
          try { scriptData = JSON.parse(fullText.slice(start, i + 1)); } catch { /* skip */ }
          break;
        }
      }
    }
  }

  if (!scriptData || !scriptData.script || !scriptData.video_prompt) {
    return new Response(JSON.stringify({ success: false, error: "Failed to parse script response" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, data: scriptData }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
