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

// ── Instagram Login ─────────────────────────────────────────────────────────
// Uses Instagram's private API (mobile endpoint) to authenticate with
// username + password and obtain a session.
async function loginInstagram(username: string, password: string) {
  // Step 1: Get the CSRF token and device info
  const preLoginRes = await fetch("https://i.instagram.com/api/v1/web/accounts/login/ajax/", {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const preLoginData = await preLoginRes.json();
  const csrfToken = preLoginData.config?.csrf_token || "";

  // Step 2: Submit login
  const loginBody = new URLSearchParams();
  loginBody.append("username", username);
  loginBody.append("password", password);
  loginBody.append("csrf_token", csrfToken);
  loginBody.append("into", "1");

  const loginRes = await fetch("https://i.instagram.com/api/v1/web/accounts/login/ajax/", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: loginBody.toString(),
  });

  // Collect cookies from the response
  const cookies = loginRes.headers.get("set-cookie") || "";
  const loginData = await loginRes.json();

  if (loginData.status === "fail") {
    const msg = loginData.message || "";
    if (msg.includes("challenge_required")) {
      return { success: false, error: "challenge_required", status: "challenge_required" as const };
    }
    if (msg.includes("invalid") || msg.includes("password")) {
      return { success: false, error: "Invalid username or password", status: "invalid_credentials" as const };
    }
    return { success: false, error: msg || "Login failed", status: "invalid_credentials" as const };
  }

  if (!loginData.authenticated) {
    return { success: false, error: "Login failed — not authenticated", status: "invalid_credentials" as const };
  }

  // Step 3: Get user info from the session
  const userId = loginData.userId;
  const sessionCookies = cookies;

  return {
    success: true,
    data: {
      account_id: String(userId),
      account_username: username,
      account_name: username,
      session_cookies: { raw: sessionCookies, csrf: csrfToken },
    },
  };
}

// ── Facebook Login ──────────────────────────────────────────────────────────
// Uses Facebook's mobile login endpoint to authenticate with
// email/username + password and obtain a session.
async function loginFacebook(username: string, password: string) {
  // Step 1: Get initial cookies and login form data
  const initRes = await fetch("https://m.facebook.com/login/device-based/regular/login/", {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    },
  });

  const initCookies = initRes.headers.get("set-cookie") || "";

  // Step 2: Submit login
  const loginBody = new URLSearchParams();
  loginBody.append("email", username);
  loginBody.append("pass", password);
  loginBody.append("login", "1");
  loginBody.append("next", "https://m.facebook.com/home.php");

  const loginRes = await fetch("https://m.facebook.com/login/device-based/regular/login/", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": initCookies,
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  const loginCookies = loginRes.headers.get("set-cookie") || "";
  const allCookies = initCookies + "; " + loginCookies;

  // Check if login succeeded by looking for session cookies
  const hasSession = allCookies.includes("c_user") || allCookies.includes("xs");

  if (!hasSession) {
    const body = await loginRes.text().catch(() => "");
    if (body.includes("checkpoint") || body.includes("approval")) {
      return { success: false, error: "Account requires approval. Please check your email or SMS for a verification code.", status: "challenge_required" as const };
    }
    if (body.includes("Invalid") || body.includes("incorrect")) {
      return { success: false, error: "Invalid email/username or password", status: "invalid_credentials" as const };
    }
    return { success: false, error: "Login failed", status: "invalid_credentials" as const };
  }

  // Step 3: Extract user ID from cookies
  const cUserMatch = allCookies.match(/c_user=(\d+)/);
  const userId = cUserMatch?.[1] || "unknown";

  return {
    success: true,
    data: {
      account_id: userId,
      account_username: username,
      account_name: username,
      session_cookies: { raw: allCookies },
    },
  };
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed", 405);

  // Verify JWT
  const user = await verifyAuth(req);
  if (!user) return err("Unauthorized");

  let platform: string, username: string, password: string;
  try {
    const body = await req.json();
    platform = String(body.platform || "").toLowerCase();
    username = String(body.username || "").trim();
    password = String(body.password || "");

    if (!platform || !["instagram", "facebook"].includes(platform)) {
      throw new Error("Platform must be 'instagram' or 'facebook'");
    }
    if (!username) throw new Error("Username is required");
    if (!password) throw new Error("Password is required");
  } catch (e) {
    return err((e as Error).message || "Invalid request body");
  }

  // Attempt login
  let result: { success: boolean; data?: Record<string, unknown>; error?: string; status?: string };

  if (platform === "instagram") {
    result = await loginInstagram(username, password);
  } else {
    result = await loginFacebook(username, password);
  }

  if (!result.success) {
    return ok({ success: false, error: result.error, status: result.status });
  }

  // Store credentials in database
  const credData = result.data!;
  const { error: upsertError } = await supabase
    .from("social_credentials")
    .upsert(
      {
        user_id: user.id,
        platform,
        account_id: credData.account_id,
        account_name: credData.account_name,
        account_username: credData.account_username,
        session_cookies: credData.session_cookies,
        login_status: "active",
        is_active: true,
      },
      { onConflict: "user_id,platform" }
    );

  if (upsertError) {
    console.error("Database upsert error:", upsertError);
    return err("Failed to save credentials");
  }

  return ok({
    success: true,
    data: {
      platform,
      account_id: credData.account_id,
      account_username: credData.account_username,
      account_name: credData.account_name,
      status: "active",
    },
  });
});
