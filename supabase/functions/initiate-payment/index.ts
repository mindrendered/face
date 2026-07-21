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
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let plan: string, method: string;
  try {
    const body = await req.json();
    plan = String(body.plan || "").toLowerCase();
    method = String(body.method || "upi").toLowerCase();

    if (!plan || !["beginner", "daily", "pro"].includes(plan)) {
      throw new Error("Plan must be 'beginner', 'daily', or 'pro'");
    }
    if (!method || !["upi", "card", "netbanking", "wallet", "manual"].includes(method)) {
      throw new Error("Invalid payment method");
    }
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  // Get plan pricing from platform settings
  const { data: plansSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "plans")
    .single();

  const plansConfig = plansSetting?.value as Record<string, { price: number; label: string }> | null;
  const planConfig = plansConfig?.[plan];

  if (!planConfig) {
    return err("Plan not found in configuration");
  }

  // Get currency settings
  const { data: currencySetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_currency")
    .single();

  const currency = (currencySetting?.value as string) || "INR";

  // Get UPI settings for UPI payments
  let upiId = "";
  let upiName = "";
  if (method === "upi") {
    const { data: upiIdSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "payment_upi_id")
      .single();
    const { data: upiNameSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "payment_upi_name")
      .single();
    upiId = (upiIdSetting?.value as string) || "";
    upiName = (upiNameSetting?.value as string) || "";
  }

  // Get expiry setting
  const { data: expirySetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_expiry_minutes")
    .single();
  const expiryMinutes = parseInt(String(expirySetting?.value || "30"));

  // Get next invoice number
  const { data: invoiceSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_invoice_start")
    .single();
  const invoiceStart = parseInt(String(invoiceSetting?.value || "1001"));

  const { data: prefixSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_invoice_prefix")
    .single();
  const invoicePrefix = (prefixSetting?.value as string) || "FVL-";

  // Count existing payments to generate invoice number
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true });

  const invoiceNumber = `${invoicePrefix}${invoiceStart + (count || 0)}`;

  // Create payment record
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      plan,
      amount: planConfig.price,
      currency,
      method,
      status: "pending",
      payment_gateway: method === "upi" ? "manual_upi" : method,
      upi_id: upiId,
      metadata: {
        invoice_number: invoiceNumber,
        plan_label: planConfig.label,
        upi_name: upiName,
      },
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Payment creation error:", insertError);
    return err("Failed to create payment record");
  }

  return ok({
    success: true,
    data: {
      payment_id: payment.id,
      invoice_number: invoiceNumber,
      plan,
      amount: planConfig.price,
      currency,
      method,
      upi_id: upiId,
      upi_name: upiName,
      expires_at: expiresAt,
      status: "pending",
    },
  });
});
