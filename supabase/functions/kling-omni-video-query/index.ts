import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function streamVideoToStorage(videoUrl: string): Promise<{ success: true; publicUrl: string } | { success: false; error: string }> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.startsWith("video/") ? contentType.split("/")[1].split(";")[0] : "mp4";
    const filePath = `uploads/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("generated-media")
      .upload(filePath, response.body!, { contentType, cacheControl: "no-cache", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("generated-media").getPublicUrl(filePath);
    return { success: true, publicUrl: urlData.publicUrl };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

  // Verify JWT — reject unauthenticated requests
  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let taskId: string;
  try {
    const body = await req.json();
    taskId = body.task_id;
    if (!taskId) throw new Error("Missing task_id");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) return err("Server configuration error: missing API key");

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://app-cveo6hhr7n5t-api-pLVzAEz1ZQOL.gateway.appmedo.com/v1/videos/omni-video/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
      }
    );
  } catch (fetchErr) {
    return err(`Network error: ${(fetchErr as Error).message}`);
  }

  if (upstream.status === 429) return err("Quota exceeded");
  if (upstream.status === 402) return err("Insufficient balance");
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => upstream.status.toString());
    return err(`Upstream error ${upstream.status}: ${body}`);
  }

  const result = await upstream.json();
  if (result.code !== 0) {
    // Non-zero API code is an application error — return 200 with error field
    return ok({ success: false, error: `API error ${result.code}: ${result.message}`, data: result.data });
  }

  const taskData = result.data;

  if (taskData.task_status === "succeed" && taskData.task_result?.videos?.length > 0) {
    const videos = await Promise.all(
      taskData.task_result.videos.map(async (video: { id: string; url: string; watermark_url?: string; duration: string }) => {
        const transfer = await streamVideoToStorage(video.url);
        return {
          ...video,
          url: transfer.success ? transfer.publicUrl : video.url,
          storage_transfer_error: transfer.success ? undefined : transfer.error,
        };
      })
    );
    taskData.task_result.videos = videos;
  }

  return ok(result);
});
