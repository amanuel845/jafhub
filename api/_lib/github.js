// api/_lib/github.js
// Shared helpers for jafhub-full API functions.

export const GITHUB_API = "https://api.github.com";
export const GITHUB_GRAPHQL = "https://api.github.com/graphql";
export const GITHUB_API_VERSION = "2022-11-28";
export const USER_AGENT = "jafhub-full/3.0";

export const ALLOWED_METHODS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"
]);

// Request headers we are willing to forward to GitHub.
const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "content-type",
  "if-none-match",
  "if-match",
  "x-github-api-version"
];

// Response headers we expose back to the browser.
export const RESPONSE_HEADER_ALLOWLIST = [
  "content-type",
  "content-language",
  "cache-control",
  "etag",
  "last-modified",
  "location",
  "link",
  "retry-after",
  "deprecation",
  "sunset",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-used",
  "x-ratelimit-resource",
  "x-github-request-id",
  "x-github-media-type",
  "x-oauth-scopes",
  "x-accepted-oauth-scopes"
];

/**
 * Resolve the Authorization header using priority:
 *   1. Client-supplied Authorization (Bearer …)
 *   2. process.env.GITHUB_TOKEN
 *   3. none (anonymous)
 * Returns { header, mode } where mode is "client" | "server" | "public".
 */
export function resolveAuth(req) {
  const inbound = req.headers.authorization || req.headers.Authorization;
  if (inbound && /^Bearer\s+\S+/i.test(inbound)) {
    return { header: inbound, mode: "client" };
  }
  if (process.env.GITHUB_TOKEN) {
    return { header: `Bearer ${process.env.GITHUB_TOKEN}`, mode: "server" };
  }
  return { header: null, mode: "public" };
}

/** Build the request header set for an upstream GitHub call. */
export function buildUpstreamHeaders(req, { json = false } = {}) {
  const headers = {
    Accept: json ? "application/json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": USER_AGENT
  };
  if (json) headers["Content-Type"] = "application/json";

  for (const name of REQUEST_HEADER_ALLOWLIST) {
    const v = req.headers[name];
    if (!v) continue;
    const value = Array.isArray(v) ? v[0] : String(v);
    if (name === "x-github-api-version") headers["X-GitHub-Api-Version"] = value;
    else if (name === "accept")           headers.Accept = value;
    else if (name === "content-type")     headers["Content-Type"] = value;
    else if (name === "if-none-match")    headers["If-None-Match"] = value;
    else if (name === "if-match")         headers["If-Match"] = value;
  }

  const auth = resolveAuth(req);
  if (auth.header) headers.Authorization = auth.header;

  return headers;
}

/** Copy allowlisted response headers from an upstream Response onto res. */
export function copyUpstreamHeaders(upstream, res) {
  for (const name of RESPONSE_HEADER_ALLOWLIST) {
    const v = upstream.headers.get(name);
    if (v) res.setHeader(name, v);
  }
}

/** Apply CORS headers based on ALLOWED_ORIGINS. Never sets ACAO unless allowed. */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origin && allowed.length) {
    if (allowed.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-GitHub-Api-Version,Accept,If-None-Match,If-Match"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

/** Read the request body as a string, capped to `limit` bytes. */
export async function readBody(req, limit = 1024 * 1024) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes((req.method || "").toUpperCase())) {
    return undefined;
  }

  if (req.body != null) {
    const s = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (s.length > limit) {
      throw Object.assign(new Error("Request body too large"), { status: 413 });
    }
    return s || undefined;
  }

  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        try { req.destroy(); } catch {}
      }
    });
    req.on("end", () => resolve(data || undefined));
    req.on("error", reject);
  });
}

/** Send a JSON error response. */
export function fail(res, status, message, extra = {}) {
  res.status(status).json({ message, ...extra });
}

/**
 * Normalize the catch-all path from req.query.path and validate it.
 * Returns the joined path (no leading slash) or throws.
 */
export function normalizePath(rawPath) {
  const segments = Array.isArray(rawPath)
    ? rawPath
    : String(rawPath || "").split("/").filter(Boolean);

  const clean = [];
  for (const seg of segments) {
    let decoded;
    try { decoded = decodeURIComponent(seg); }
    catch { throw Object.assign(new Error("Invalid path encoding"), { status: 400 }); }

    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("://") ||
      decoded.includes("\0") ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      throw Object.assign(new Error("Invalid GitHub API path"), { status: 400 });
    }
    clean.push(encodeURIComponent(decoded));
  }
  if (!clean.length) {
    throw Object.assign(new Error("Empty GitHub API path"), { status: 400 });
  }
  return clean.join("/");
}
