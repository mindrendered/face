import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

const err = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Verify caller is authenticated
  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized", 401);

  // Check caller is admin
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return err("Admin access required", 403);

  // Parse request body
  const { target_user_id } = await req.json();
  if (!target_user_id) return err("target_user_id is required");

  // Prevent self-deletion
  if (target_user_id === user.id) return err("Cannot delete your own account");

  // Delete the auth user (cascades to profiles and all related data)
  const { error } = await supabase.auth.admin.deleteUser(target_user_id);
  if (error) return err(`Delete failed: ${error.message}`);

  return ok({ success: true });
});
