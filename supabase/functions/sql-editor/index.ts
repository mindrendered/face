import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

const err = (message: string, status = 200) =>
  new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Verify the caller is an admin
async function verifyAdmin(req: Request) {
  const user = await verifyAuth(req);
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!data?.is_admin) return null;
  return user;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  const user = await verifyAdmin(req);
  if (!user) return err("Unauthorized — admin access required", 401);

  let action: string, queryId: string | undefined, query: string | undefined, reason: string | undefined;
  try {
    const body = await req.json();
    action = String(body.action || "").trim();
    queryId = body.query_id ? String(body.query_id).trim() : undefined;
    query = body.query ? String(body.query).trim() : undefined;
    reason = body.reason ? String(body.reason).trim() : undefined;

    if (!action) throw new Error("action is required");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  switch (action) {
    // ── Submit a new query for approval ──────────────────────────────────
    case "submit": {
      if (!query) return err("query is required");

      const { data, error } = await supabase
        .from("sql_queries")
        .insert({ query, created_by: user.id, status: "pending" })
        .select()
        .single();

      if (error) return err(error.message);
      return ok({ success: true, data });
    }

    // ── Approve a pending query ──────────────────────────────────────────
    case "approve": {
      if (!queryId) return err("query_id is required");

      // Fetch the query
      const { data: existing, error: fetchErr } = await supabase
        .from("sql_queries")
        .select("created_by, status")
        .eq("id", queryId)
        .single();

      if (fetchErr || !existing) return err("Query not found");
      if (existing.status !== "pending") return err("Query is not pending");
      if (existing.created_by === user.id) return err("Cannot approve your own query");

      const { error } = await supabase
        .from("sql_queries")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", queryId);

      if (error) return err(error.message);
      return ok({ success: true });
    }

    // ── Reject a pending query ───────────────────────────────────────────
    case "reject": {
      if (!queryId) return err("query_id is required");

      const { data: existing, error: fetchErr } = await supabase
        .from("sql_queries")
        .select("created_by, status")
        .eq("id", queryId)
        .single();

      if (fetchErr || !existing) return err("Query not found");
      if (existing.status !== "pending") return err("Query is not pending");

      const { error } = await supabase
        .from("sql_queries")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          error_message: reason || null,
        })
        .eq("id", queryId);

      if (error) return err(error.message);
      return ok({ success: true });
    }

    // ── Execute an approved query ────────────────────────────────────────
    case "execute": {
      if (!queryId) return err("query_id is required");

      const { data: existing, error: fetchErr } = await supabase
        .from("sql_queries")
        .select("query, status")
        .eq("id", queryId)
        .single();

      if (fetchErr || !existing) return err("Query not found");
      if (existing.status !== "approved") return err("Query must be approved before execution");

      try {
        // Execute via raw SQL using the service role
        const execSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: result, error: execErr } = await execSupabase.rpc("exec_sql", {
          query_text: existing.query,
        });

        if (execErr) {
          await supabase
            .from("sql_queries")
            .update({
              status: "failed",
              error_message: execErr.message,
              executed_at: new Date().toISOString(),
            })
            .eq("id", queryId);
          return ok({ success: false, error: execErr.message });
        }

        // Try to extract row count from result
        let rowCount: number | null = null;
        let resultData: unknown = result;

        if (Array.isArray(result)) {
          rowCount = result.length;
          resultData = result.length > 100 ? result.slice(0, 100) : result; // Cap at 100 rows for display
        }

        await supabase
          .from("sql_queries")
          .update({
            status: "executed",
            result: resultData as Record<string, unknown>,
            row_count: rowCount,
            executed_at: new Date().toISOString(),
          })
          .eq("id", queryId);

        return ok({ success: true, data: { result: resultData, row_count: rowCount } });
      } catch (e) {
        await supabase
          .from("sql_queries")
          .update({
            status: "failed",
            error_message: (e as Error).message,
            executed_at: new Date().toISOString(),
          })
          .eq("id", queryId);
        return ok({ success: false, error: (e as Error).message });
      }
    }

    // ── List queries ─────────────────────────────────────────────────────
    case "list": {
      const statusFilter = queryId; // Reuse queryId param for status filter
      let q = supabase
        .from("sql_queries")
        .select("*, profiles!sql_queries_created_by_fkey(email)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) return err(error.message);

      // Flatten creator email
      const rows = (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        creator_email: (row.profiles as Record<string, unknown>)?.email ?? null,
        profiles: undefined,
      }));

      return ok({ success: true, data: rows });
    }

    // ── Delete a query ─────────────────────────────────────────────────
    case "delete": {
      if (!queryId) return err("query_id is required");

      const { error } = await supabase
        .from("sql_queries")
        .delete()
        .eq("id", queryId);

      if (error) return err(error.message);
      return ok({ success: true });
    }

    default:
      return err(`Unknown action: ${action}`);
  }
});
