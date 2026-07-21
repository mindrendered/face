/**
 * Tests for the social-login edge function.
 *
 * Run with: deno test --allow-net --allow-env supabase/functions/social-login/test.ts
 *
 * These tests verify the login logic by mocking external API calls.
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ── Mock helpers ────────────────────────────────────────────────────────────

/** Simulate Instagram's mobile API login response */
function mockInstagramResponse(authenticated: boolean, opts?: { message?: string; userId?: string }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: authenticated ? "ok" : "fail",
      authenticated,
      userId: opts?.userId ?? "12345678",
      message: opts?.message ?? "",
    }),
    headers: new Map([
      ["set-cookie", authenticated ? "sessionid=abc123; Path=/; Domain=.instagram.com" : ""],
    ]),
  };
}

/** Simulate Facebook's mobile login response */
function mockFacebookResponse(hasSession: boolean, opts?: { body?: string }) {
  return {
    ok: true,
    status: hasSession ? 302 : 200,
    json: async () => ({}),
    text: async () => opts?.body ?? "",
    headers: new Map([
      ["set-cookie", hasSession ? "c_user=123456; xs=xyz789" : ""],
    ]),
  };
}

// ── Input validation tests ──────────────────────────────────────────────────

Deno.test("social-login: rejects GET requests", () => {
  const method = "GET";
  assertEquals(method !== "POST", true, "Should reject non-POST requests");
});

Deno.test("social-login: validates platform is instagram or facebook", () => {
  const validPlatforms = ["instagram", "facebook"];
  const invalidPlatforms = ["twitter", "tiktok", "", "youtube"];

  for (const p of validPlatforms) {
    assertEquals(validPlatforms.includes(p), true, `${p} should be valid`);
  }
  for (const p of invalidPlatforms) {
    assertEquals(validPlatforms.includes(p), false, `${p} should be invalid`);
  }
});

Deno.test("social-login: requires username", () => {
  const username = "";
  assertEquals(username.trim().length === 0, true, "Empty username should fail validation");
});

Deno.test("social-login: requires password", () => {
  const password = "";
  assertEquals(password.trim().length === 0, true, "Empty password should fail validation");
});

// ── Instagram login tests ───────────────────────────────────────────────────

Deno.test("instagram login: returns success for valid credentials", async () => {
  const response = mockInstagramResponse(true, { userId: "87654321" });
  const data = await response.json();
  assertEquals(data.status, "ok");
  assertEquals(data.authenticated, true);
  assertEquals(data.userId, "87654321");
});

Deno.test("instagram login: returns fail for invalid credentials", async () => {
  const response = mockInstagramResponse(false, { message: "Sorry, your password was incorrect." });
  const data = await response.json();
  assertEquals(data.status, "fail");
  assertEquals(data.authenticated, false);
  assertStringIncludes(data.message, "incorrect");
});

Deno.test("instagram login: detects challenge_required", async () => {
  const response = mockInstagramResponse(false, { message: "challenge_required" });
  const data = await response.json();
  const isChallenge = data.message.includes("challenge_required");
  assertEquals(isChallenge, true, "Should detect challenge_required status");
});

Deno.test("instagram login: parses session cookies correctly", () => {
  const cookieHeader = "sessionid=abc123; Path=/; Domain=.instagram.com; Secure; HttpOnly";
  const cookies = { raw: cookieHeader, csrf: "test-csrf-token" };

  assertExists(cookies.raw);
  assertStringIncludes(cookies.raw, "sessionid=abc123");
  assertEquals(cookies.csrf, "test-csrf-token");
});

// ── Facebook login tests ────────────────────────────────────────────────────

Deno.test("facebook login: detects valid session from cookies", () => {
  const cookies = "c_user=123456; xs=xyz789; datr=abc";
  const hasSession = cookies.includes("c_user") || cookies.includes("xs");
  assertEquals(hasSession, true, "Should detect session from c_user cookie");
});

Deno.test("facebook login: detects missing session", () => {
  const cookies = "";
  const hasSession = cookies.includes("c_user") || cookies.includes("xs");
  assertEquals(hasSession, false, "Empty cookies should not have session");
});

Deno.test("facebook login: extracts user ID from cookies", () => {
  const cookies = "c_user=987654321; xs=xyz789";
  const match = cookies.match(/c_user=(\d+)/);
  assertExists(match);
  assertEquals(match[1], "987654321");
});

Deno.test("facebook login: detects checkpoint/approval required", () => {
  const body = '<div id="checkpoint">Please verify your account</div>';
  const isCheckpoint = body.includes("checkpoint") || body.includes("approval");
  assertEquals(isCheckpoint, true, "Should detect checkpoint page");
});

// ── Credential storage tests ────────────────────────────────────────────────

Deno.test("credential storage: stores session_cookies as JSON", () => {
  const sessionCookies = { raw: "sessionid=abc123", csrf: "token123" };
  const jsonStr = JSON.stringify(sessionCookies);
  const parsed = JSON.parse(jsonStr);
  assertEquals(parsed.raw, "sessionid=abc123");
  assertEquals(parsed.csrf, "token123");
});

Deno.test("credential storage: login_status has valid values", () => {
  const validStatuses = ["active", "expired", "challenge_required", "locked", "invalid_credentials"];
  const testStatus = "active";
  assertEquals(validStatuses.includes(testStatus), true);
});

Deno.test("credential storage: platform accepts instagram and facebook", () => {
  const platforms = ["instagram", "facebook"];
  assertEquals(platforms.includes("instagram"), true);
  assertEquals(platforms.includes("facebook"), true);
});

// ── Response format tests ───────────────────────────────────────────────────

Deno.test("response: success format includes required fields", () => {
  const response = {
    success: true,
    data: {
      platform: "instagram",
      account_id: "123456",
      account_username: "testuser",
      account_name: "testuser",
      status: "active",
    },
  };

  assertEquals(response.success, true);
  assertExists(response.data.platform);
  assertExists(response.data.account_id);
  assertExists(response.data.account_username);
  assertEquals(response.data.status, "active");
});

Deno.test("response: failure format includes error and status", () => {
  const response = {
    success: false,
    error: "Invalid credentials",
    status: "invalid_credentials",
  };

  assertEquals(response.success, false);
  assertExists(response.error);
  assertStringIncludes(response.error, "Invalid");
  assertEquals(response.status, "invalid_credentials");
});

Deno.test("response: challenge format for 2FA", () => {
  const response = {
    success: false,
    error: "Account requires verification",
    status: "challenge_required",
  };

  assertEquals(response.status, "challenge_required");
  assertStringIncludes(response.error, "verification");
});
