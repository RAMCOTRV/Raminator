import { env } from "cloudflare:workers";

const SESSION_COOKIE = "ramco_github_session";
const STATE_COOKIE = "ramco_github_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export type GitHubSession = GitHubUser & {
  expiresAt: number;
};

export type GitHubConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
  allowedLogin: string;
};

export function getGitHubConfig():
  | { ok: true; config: GitHubConfig }
  | { ok: false; missing: string[] } {
  const values: Record<string, string | undefined> = {
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
    GITHUB_OAUTH_REDIRECT_URI: env.GITHUB_OAUTH_REDIRECT_URI,
    GITHUB_SESSION_SECRET: env.GITHUB_SESSION_SECRET,
    GITHUB_ALLOWED_LOGIN: env.GITHUB_ALLOWED_LOGIN,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key);

  if (missing.length) return { ok: false, missing };

  return {
    ok: true,
    config: {
      clientId: values.GITHUB_CLIENT_ID!.trim(),
      clientSecret: values.GITHUB_CLIENT_SECRET!.trim(),
      redirectUri: values.GITHUB_OAUTH_REDIRECT_URI!.trim(),
      sessionSecret: values.GITHUB_SESSION_SECRET!.trim(),
      allowedLogin: values.GITHUB_ALLOWED_LOGIN!.trim().toLowerCase(),
    },
  };
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return `${value}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verify(value: string, secret: string) {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const unsigned = value.slice(0, separator);
  const signature = fromBase64Url(value.slice(separator + 1));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(unsigned));
  return valid ? unsigned : null;
}

function randomToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createOAuthState(config: GitHubConfig) {
  const state = randomToken();
  const verifier = randomToken();
  const challengeBytes = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const cookieValue = await sign(
    encodeJson({ state, verifier, expiresAt: Date.now() + STATE_TTL_SECONDS * 1000 }),
    config.sessionSecret,
  );
  return { state, verifier, challenge: toBase64Url(new Uint8Array(challengeBytes)), cookieValue };
}

export async function readOAuthState(request: Request, config: GitHubConfig, expectedState: string) {
  const cookie = getCookie(request, STATE_COOKIE);
  if (!cookie) return null;
  try {
    const unsigned = await verify(cookie, config.sessionSecret);
    if (!unsigned) return null;
    const payload = decodeJson<{ state?: string; verifier?: string; expiresAt?: number }>(unsigned);
    if (payload.state !== expectedState || !payload.verifier || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload.verifier;
  } catch {
    return null;
  }
}

export async function createSession(config: GitHubConfig, user: GitHubUser) {
  return sign(
    encodeJson({ ...user, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }),
    config.sessionSecret,
  );
}

export async function readSession(request: Request, config: GitHubConfig): Promise<GitHubSession | null> {
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return null;
  try {
    const unsigned = await verify(cookie, config.sessionSecret);
    if (!unsigned) return null;
    const payload = decodeJson<GitHubSession>(unsigned);
    if (!payload.login || !payload.id || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
    if (payload.login.toLowerCase() !== config.allowedLogin) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function cookieAttributes(request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  return `Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`;
}

export function stateCookie(request: Request, value: string) {
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; ${cookieAttributes(request, STATE_TTL_SECONDS)}`;
}

export function sessionCookie(request: Request, value: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; ${cookieAttributes(request, SESSION_TTL_SECONDS)}`;
}

export function clearAuthCookies(request: Request) {
  return [
    `${STATE_COOKIE}=; ${cookieAttributes(request, 0)}`,
    `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}`,
  ];
}

export function redirectResponse(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function appRoot(config: GitHubConfig) {
  const url = new URL(config.redirectUri);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function redirectWithError(config: GitHubConfig, error: string) {
  const url = new URL(appRoot(config));
  url.searchParams.set("github_error", error);
  return url.toString();
}
