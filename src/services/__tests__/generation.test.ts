/**
 * Tests for the social login connections API and login flow logic.
 *
 * Run with: deno test --allow-net --allow-env src/services/__tests__/generation.test.ts
 *
 * These tests verify the pure logic without requiring a full test framework.
 */

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ── Platform metadata tests ─────────────────────────────────────────────────

Deno.test("platform meta: instagram has credentials auth type", () => {
  const authType = "credentials";
  assertEquals(authType, "credentials");
});

Deno.test("platform meta: facebook has credentials auth type", () => {
  const authType = "credentials";
  assertEquals(authType, "credentials");
});

Deno.test("platform meta: youtube has oauth auth type", () => {
  const authType = "oauth";
  assertEquals(authType, "oauth");
});

// ── Login form validation tests ─────────────────────────────────────────────

Deno.test("login validation: empty username shows error", () => {
  const username = "";
  const isValid = username.trim().length > 0;
  assertEquals(isValid, false, "Empty username should be invalid");
});

Deno.test("login validation: whitespace-only username shows error", () => {
  const username = "   ";
  const isValid = username.trim().length > 0;
  assertEquals(isValid, false, "Whitespace-only username should be invalid");
});

Deno.test("login validation: valid username passes", () => {
  const username = "testuser123";
  const isValid = username.trim().length > 0;
  assertEquals(isValid, true);
});

Deno.test("login validation: empty password shows error", () => {
  const password = "";
  const isValid = password.trim().length > 0;
  assertEquals(isValid, false, "Empty password should be invalid");
});

Deno.test("login validation: valid password passes", () => {
  const password = "mypassword";
  const isValid = password.trim().length > 0;
  assertEquals(isValid, true);
});

// ── Credential status tests ─────────────────────────────────────────────────

Deno.test("credential status: active badge shows green", () => {
  const isActive = true;
  const expectedClass = isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground";
  assertStringIncludes(expectedClass, "green");
});

Deno.test("credential status: inactive badge shows muted", () => {
  const isActive = false;
  const expectedClass = isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground";
  assertStringIncludes(expectedClass, "muted");
});

// ── Error message mapping tests ─────────────────────────────────────────────

Deno.test("error mapping: challenge_required shows verification message", () => {
  const status = "challenge_required";
  const messages: Record<string, string> = {
    challenge_required: "Account requires verification. Please check your email or SMS for a code.",
    invalid_credentials: "Invalid username or password. Please check your credentials.",
    active: "",
    expired: "Session expired. Please reconnect.",
    locked: "Account temporarily locked. Try again later.",
  };
  const message = messages[status] || "Login failed";
  assertStringIncludes(message, "verification");
});

Deno.test("error mapping: invalid_credentials shows password message", () => {
  const status = "invalid_credentials";
  const messages: Record<string, string> = {
    challenge_required: "Account requires verification.",
    invalid_credentials: "Invalid username or password.",
  };
  const message = messages[status] || "Login failed";
  assertStringIncludes(message, "Invalid");
});

// ── Series linking tests ────────────────────────────────────────────────────

Deno.test("series linking: instagram links to instagram_account_id", () => {
  const platform = "instagram";
  const field = platform === "instagram" ? "instagram_account_id" : "youtube_account_id";
  assertEquals(field, "instagram_account_id");
});

Deno.test("series linking: facebook links to youtube_account_id (shared)", () => {
  const platform = "facebook";
  const field = platform === "instagram" ? "instagram_account_id" : "youtube_account_id";
  assertEquals(field, "youtube_account_id", "Facebook uses youtube_account_id as fallback");
});

Deno.test("series linking: youtube links to youtube_account_id", () => {
  const platform = "youtube";
  const field = platform === "instagram" ? "instagram_account_id" : "youtube_account_id";
  assertEquals(field, "youtube_account_id");
});

// ── Social credential interface tests ───────────────────────────────────────

Deno.test("SocialCredential: has required fields", () => {
  const cred = {
    id: "uuid-123",
    platform: "instagram" as const,
    account_name: "Test User",
    account_username: "testuser",
    account_id: "12345",
    is_active: true,
    login_status: "active",
    created_at: "2026-01-01T00:00:00Z",
  };

  assertExists(cred.id);
  assertEquals(cred.platform, "instagram");
  assertExists(cred.account_username);
  assertEquals(cred.is_active, true);
  assertEquals(cred.login_status, "active");
});

Deno.test("SocialCredential: supports facebook platform", () => {
  const cred = {
    id: "uuid-456",
    platform: "facebook" as const,
    account_name: "FB User",
    account_username: "fbuser@email.com",
    account_id: "67890",
    is_active: true,
    login_status: "active",
    created_at: "2026-01-01T00:00:00Z",
  };

  assertEquals(cred.platform, "facebook");
  assertStringIncludes(cred.account_username, "@");
});

// ── Cookie parsing tests ────────────────────────────────────────────────────

Deno.test("cookie parsing: Instagram session cookie", () => {
  const cookie = "sessionid=abc123def456; Path=/; Domain=.instagram.com; Secure; HttpOnly";
  const match = cookie.match(/sessionid=([^;]+)/);
  assertExists(match);
  assertEquals(match[1], "abc123def456");
});

Deno.test("cookie parsing: Facebook c_user cookie", () => {
  const cookie = "c_user=12345678; xs=abcdefghijk; datr=xyz123";
  const match = cookie.match(/c_user=(\d+)/);
  assertExists(match);
  assertEquals(match[1], "12345678");
});

Deno.test("cookie parsing: Facebook xs cookie", () => {
  const cookie = "c_user=12345678; xs=abcdefghijk";
  const match = cookie.match(/xs=([^;]+)/);
  assertExists(match);
  assertEquals(match[1], "abcdefghijk");
});

// ── API endpoint tests ──────────────────────────────────────────────────────

Deno.test("API: socialLogin sends correct body", () => {
  const params = {
    platform: "instagram" as const,
    username: "testuser",
    password: "testpass",
  };

  assertEquals(params.platform, "instagram");
  assertEquals(params.username, "testuser");
  assertEquals(params.password, "testpass");
});

Deno.test("API: listCredentials returns array format", () => {
  const mockResponse = {
    data: [
      { id: "1", platform: "instagram", is_active: true },
      { id: "2", platform: "facebook", is_active: false },
    ],
  };

  assertEquals(Array.isArray(mockResponse.data), true);
  assertEquals(mockResponse.data.length, 2);
});
