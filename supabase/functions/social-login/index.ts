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

const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IG_APP_ID = "936619743392459";
const FB_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ── Instagram Login ─────────────────────────────────────────────────────────
async function loginInstagram(username: string, password: string) {
  // Step 1: Initiate a session to get CSRF token and device ID
  const initRes = await fetch("https://www.instagram.com/accounts/login/", {
    method: "GET",
    headers: { "User-Agent": IG_UA },
    redirect: "manual",
  });

  // Collect all set-cookie headers
  const initCookies = collectCookies(initRes);

  // Step 2: Extract CSRF token from cookies
  const csrfToken = extractCookie(initCookies, "csrftoken") || "";

  // Step 3: Submit login via the web AJAX endpoint
  const loginBody = new URLSearchParams();
  loginBody.append("username", username);
  loginBody.append("password", password);
  loginBody.append("csrf_token", csrfToken);
  loginBody.append("queryParams", "{}");
  loginBody.append("optIntoOneTapLogin", "false");
  loginBody.append("trustedDeviceDetails", "{}");

  const loginRes = await fetch("https://www.instagram.com/accounts/login/ajax/", {
    method: "POST",
    headers: {
      "User-Agent": IG_UA,
      "X-IG-App-ID": IG_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRFToken": csrfToken,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": initCookies,
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  const loginCookies = collectCookies(loginRes);
  const allCookies = mergeCookies(initCookies, loginCookies);
  const loginData = await loginRes.json().catch(() => ({}));

  // Handle login failure
  if (loginData.status === "fail" || !loginData.authenticated) {
    const msg = String(loginData.message || "").toLowerCase();
    if (msg.includes("challenge") || msg.includes("two_factor") || msg.includes("checkpoint")) {
      return { success: false, error: "Your account requires two-factor authentication. Please disable 2FA temporarily or use a session token.", status: "challenge_required" as const };
    }
    if (msg.includes("invalid") || msg.includes("password") || msg.includes("sorry")) {
      return { success: false, error: "Invalid username or password", status: "invalid_credentials" as const };
    }
    if (msg.includes("rate") || msg.includes("try again")) {
      return { success: false, error: "Too many attempts. Please wait a few minutes and try again.", status: "rate_limited" as const };
    }
    return { success: false, error: loginData.message || "Login failed. Please check your credentials.", status: "invalid_credentials" as const };
  }

  const userId = String(loginData.userId || "");

  // Step 4: Fetch the user profile to get username and full name
  let accountName = username;
  let profilePic = "";

  try {
    const profileRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": IG_UA,
        "X-IG-App-ID": IG_APP_ID,
        "Cookie": allCookies,
      },
    });
    const profileData = await profileRes.json();
    const user = profileData?.data?.user;
    if (user) {
      accountName = user.full_name || user.username || username;
      profilePic = user.profile_pic_url || "";
    }
  } catch { /* profile fetch is optional */ }

  // Step 5: Verify session is actually alive by hitting the web profile endpoint
  let sessionValid = true;
  try {
    const checkRes = await fetch("https://www.instagram.com/api/v1/accounts/current_user/?edit=true", {
      headers: {
        "User-Agent": IG_UA,
        "X-IG-App-ID": IG_APP_ID,
        "Cookie": allCookies,
      },
    });
    sessionValid = checkRes.ok;
  } catch { /* session check is best-effort */ }

  return {
    success: true,
    data: {
      account_id: userId,
      account_username: username,
      account_name: accountName,
      profile_pic: profilePic,
      session_cookies: {
        raw: allCookies,
        csrf: extractCookie(allCookies, "csrftoken") || csrfToken,
        session_id: extractCookie(allCookies, "sessionid") || "",
        ds_user_id: userId,
      },
      session_valid: sessionValid,
    },
  };
}

// ── Facebook Login ──────────────────────────────────────────────────────────
async function loginFacebook(email: string, password: string) {
  // Step 1: Load the login page to get initial cookies and form data (lsd, jazoest)
  const initRes = await fetch("https://m.facebook.com/login/?next&refsrc=deprecated", {
    method: "GET",
    headers: { "User-Agent": FB_UA },
    redirect: "manual",
  });
  const initCookies = collectCookies(initRes);
  const initHtml = await initRes.text().catch(() => "");

  // Extract hidden form fields
  const lsd = initHtml.match(/name="lsd" value="([^"]+)"/)?.[1] || "";
  const jazoest = initHtml.match(/name="jazoest" value="([^"]+)"/)?.[1] || "";

  // Step 2: Submit login
  const loginBody = new URLSearchParams();
  loginBody.append("email", email);
  loginBody.append("pass", password);
  loginBody.append("login", "1");
  loginBody.append("lsd", lsd);
  loginBody.append("jazoest", jazoest);
  loginBody.append("next", "https://m.facebook.com/home.php");

  const loginRes = await fetch("https://m.facebook.com/login/device-based/regular/login/", {
    method: "POST",
    headers: {
      "User-Agent": FB_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": initCookies,
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  const loginCookies = collectCookies(loginRes);
  const allCookies = mergeCookies(initCookies, loginCookies);

  // Check for session cookies
  const cUser = extractCookie(allCookies, "c_user");
  const xs = extractCookie(allCookies, "xs");

  if (!cUser || !xs) {
    // Check for various error states
    const body = await loginRes.text().catch(() => "");
    if (body.includes("checkpoint") || body.includes("approval") || body.includes("one_tap_login")) {
      return { success: false, error: "Account requires verification. Check your email or SMS for a code.", status: "challenge_required" as const };
    }
    if (body.includes("Invalid") || body.includes("incorrect") || body.includes("wrong")) {
      return { success: false, error: "Invalid email or password", status: "invalid_credentials" as const };
    }
    if (body.includes("temporarily") || body.includes("locked")) {
      return { success: false, error: "Account temporarily locked. Try again later.", status: "locked" as const };
    }
    if (body.includes("two_factor") || body.includes("2fa")) {
      return { success: false, error: "Two-factor authentication required. Please disable 2FA temporarily.", status: "challenge_required" as const };
    }
    return { success: false, error: "Login failed. Please check your email and password.", status: "invalid_credentials" as const };
  }

  // Step 3: Fetch user profile info from Facebook
  let accountName = email;
  let profilePic = "";

  try {
    const profileRes = await fetch("https://m.facebook.com/me?fields=name,email,picture", {
      headers: {
        "User-Agent": FB_UA,
        "Cookie": allCookies,
      },
    });
    const profileData = await profileRes.json().catch(() => ({}));
    if (profileData.name) accountName = profileData.name;
    if (profileData.picture?.data?.url) profilePic = profileData.picture.data.url;
  } catch { /* profile fetch is optional */ }

  return {
    success: true,
    data: {
      account_id: cUser,
      account_username: email,
      account_name: accountName,
      profile_pic: profilePic,
      session_cookies: {
        raw: allCookies,
        c_user: cUser,
        xs: xs,
        datr: extractCookie(allCookies, "datr") || "",
      },
    },
  };
}

// ── Cookie Helpers ──────────────────────────────────────────────────────────
function collectCookies(res: Response): string {
  const cookies: string[] = [];
  // deno-lint-ignore no-explicit-any
  const headers = (res as any).headers;
  if (typeof headers.entries === "function") {
    for (const [key, value] of headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
        // May be multiple set-cookie values separated by newlines
        const parts = value.split("\n");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) cookies.push(trimmed);
        }
      }
    }
  }
  // Fallback for single set-cookie
  if (cookies.length === 0) {
    const single = headers.get?.("set-cookie");
    if (single) {
      for (const part of single.split("\n")) {
        const trimmed = part.trim();
        if (trimmed) cookies.push(trimmed);
      }
    }
  }
  // Convert set-cookie headers to "name=value" pairs for the Cookie header
  return cookies
    .map(c => c.split(";")[0]) // take "name=value" part
    .filter(c => c.includes("="))
    .join("; ");
}

function extractCookie(cookieStr: string, name: string): string {
  const match = cookieStr.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] || "";
}

function mergeCookies(a: string, b: string): string {
  const map = new Map<string, string>();
  for (const pair of [...a.split("; "), ...b.split("; ")]) {
    const [key, ...rest] = pair.split("=");
    if (key && rest.length) map.set(key.trim(), rest.join("="));
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("Method not allowed");

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
    if (!username) throw new Error("Username / email is required");
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
    return err("Failed to save credentials to database");
  }

  return ok({
    success: true,
    data: {
      platform,
      account_id: credData.account_id,
      account_username: credData.account_username,
      account_name: credData.account_name,
      profile_pic: credData.profile_pic || "",
      status: "active",
    },
  });
});
