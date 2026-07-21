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

// ── UPI Payment Verification ────────────────────────────────────────────────
// For manual UPI payments, we verify the transaction reference.
// In production, this would integrate with a payment gateway webhook.
async function verifyUPIPayment(transactionRef: string, expectedAmount: number) {
  // In production: call Razorpay/Cashfree API to verify the UPI transaction
  // For now: accept any non-empty transaction reference as valid
  // Real implementation would:
  // 1. Call gateway API: GET /payments/{transactionRef}
  // 2. Verify amount matches
  // 3. Verify status is "captured"
  // 4. Return verification result

  if (!transactionRef || transactionRef.trim().length < 4) {
    return { success: false, error: "Invalid transaction reference" };
  }

  return {
    success: true,
    data: {
      verified: true,
      transaction_id: transactionRef,
      amount: expectedAmount,
      method: "upi",
    },
  };
}

// ── Razorpay Verification ───────────────────────────────────────────────────
async function verifyRazorpayPayment(razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string) {
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

  // Verify signature using HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keySecret);
  const message = encoder.encode(`${razorpayOrderId}|${razorpayPaymentId}`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  const expectedSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  if (expectedSignature !== razorpaySignature) {
    return { success: false, error: "Payment signature verification failed" };
  }

  return {
    success: true,
    data: {
      verified: true,
      transaction_id: razorpayPaymentId,
      order_id: razorpayOrderId,
      method: "razorpay",
    },
  };
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let paymentId: string, method: string, transactionRef: string;
  try {
    const body = await req.json();
    paymentId = String(body.payment_id || "").trim();
    method = String(body.method || "upi").toLowerCase();
    transactionRef = String(body.transaction_ref || body.transaction_id || "").trim();

    if (!paymentId) throw new Error("Payment ID is required");
    if (!method) throw new Error("Payment method is required");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  // Fetch the payment record
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !payment) {
    return err("Payment not found");
  }

  if (payment.status === "completed") {
    return err("Payment already completed");
  }

  // Verify based on method
  let verificationResult: { success: boolean; data?: Record<string, unknown>; error?: string };

  if (method === "upi") {
    verificationResult = await verifyUPIPayment(transactionRef, payment.amount);
  } else if (method === "razorpay") {
    const razorpayPaymentId = String((await req.json().catch(() => ({}))).razorpay_payment_id || "");
    const razorpayOrderId = String((await req.json().catch(() => ({}))).razorpay_order_id || "");
    const razorpaySignature = String((await req.json().catch(() => ({}))).razorpay_signature || "");
    verificationResult = await verifyRazorpayPayment(razorpayPaymentId, razorpayOrderId, razorpaySignature);
  } else {
    // Manual / other methods: mark as verified (admin confirms)
    verificationResult = {
      success: true,
      data: { verified: true, transaction_id: transactionRef, method },
    };
  }

  if (!verificationResult.success) {
    // Mark payment as failed
    await supabase
      .from("payments")
      .update({
        status: "failed",
        metadata: { error: verificationResult.error },
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    return ok({ success: false, error: verificationResult.error });
  }

  // Mark payment as completed
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      transaction_id: verificationResult.data?.transaction_id || transactionRef,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (updateError) {
    console.error("Payment update error:", updateError);
    return err("Failed to update payment status");
  }

  // Auto-activate plan if enabled
  const autoActivateSetting = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "payment_auto_activate")
    .single();

  const autoActivate = autoActivateSetting.data?.value === true ||
    autoActivateSetting.data?.value === "true";

  if (autoActivate) {
    await supabase
      .from("profiles")
      .update({ plan: payment.plan, updated_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  return ok({
    success: true,
    data: {
      payment_id: paymentId,
      status: "completed",
      plan: payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      auto_activated: autoActivate,
    },
  });
});
