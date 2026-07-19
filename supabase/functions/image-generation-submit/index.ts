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

  let contents: unknown;
  try {
    const body = await req.json();
    contents = body.contents;
    if (!contents) throw new Error("Missing contents");

    // Enhance image prompts with trending quality keywords if not already enriched
    if (contents && typeof contents === "object" && "parts" in (contents as Record<string, unknown>)) {
      const parts = (contents as { parts: Array<{ text?: string }> }).parts;
      if (Array.isArray(parts) && parts[0]?.text) {
        const text = parts[0].text;
        const qualityKeywords = ["4k", "high resolution", "professional", "trending", "vibrant", "detailed"];
        const alreadyEnhanced = qualityKeywords.filter(k => text.toLowerCase().includes(k)).length >= 2;

        if (!alreadyEnhanced) {
          parts[0].text = `${text}. Professional quality: ultra-high resolution, vibrant saturated colours, ` +
            `trending aesthetic, sharp details, dynamic lighting, ` +
            `eye-catching composition, scroll-stopping visual impact, ` +
            `platform-optimized for social media, 4K crispness.`;
        }
      }
    }
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) return err("Server configuration error: missing API key");

  let upstream: Response;
  try {
    upstream = await fetch(
      "https://app-cveo6hhr7n5t-api-zYkZzKQJrBdL.gateway.appmedo.com/image-generation/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gateway-Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ contents }),
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
