import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function saveBase64ToStorage(markdownText: string): Promise<string> {
  const match = markdownText.match(/data:([^;]+);base64,([^)]+)/);
  if (!match) throw new Error("Could not parse Base64 image from response");
  const [, mimeType, base64Data] = match;
  const ext = mimeType.split("/")[1] ?? "jpg";
  // Use uploads/ path — consistent with video query and bucket policies
  const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const { error } = await supabase.storage.from("generated-media").upload(filePath, bytes, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);
  return urlData.publicUrl;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.taskId;
    if (!taskId) throw new Error("Missing taskId");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) return err("Server configuration error: missing API key");

  let upstream: Response;
  try {
    upstream = await fetch(
      "https://app-cveo6hhr7n5t-api-GYX1lzGw0DQa.gateway.appmedo.com/image-generation/task",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Gateway-Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ taskId }),
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

  const result = await upstream.json();

  if (result?.data?.status === "SUCCESS") {
    try {
      const markdownText = result.data.result.candidates[0].content.parts[0].text;
      const publicUrl = await saveBase64ToStorage(markdownText);
      result.data.imageUrl = publicUrl;
      result.data.result.candidates[0].content.parts[0].text = `![image](${publicUrl})`;
    } catch (storageErr) {
      console.error("Storage transfer failed:", storageErr);
      // Non-fatal: result still returned without persistent URL
    }
  }

  return ok(result);
});
