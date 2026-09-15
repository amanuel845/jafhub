// api/github.js
import {
  GITHUB_API,
  ALLOWED_METHODS,
  applyCors,
  buildUpstreamHeaders,
  copyUpstreamHeaders,
  fail,
  readBody,
  resolveAuth
} from "./_lib/github.js";

export default async function handler(req, res) {
  applyCors(req, res);

  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return res.status(204).end();
  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return fail(res, 405, "Method not allowed");
  }

  // The rewrite in vercel.json injects the wildcard segment here.
  let raw = req.query?.githubPath;
  if (Array.isArray(raw)) raw = raw.join("/");
  raw = String(raw || "").replace(/^\/+/, "");

  const segments = raw.split("/").filter(Boolean);
  if (!segments.length) {
    return fail(res, 400, "Empty GitHub API path", {
      hint: "Use /api/github/<path>, e.g. /api/github/rate_limit or /api/github/users/octocat/repos."
    });
  }

  const clean = [];
  for (const seg of segments) {
    let decoded;
    try { decoded = decodeURIComponent(seg); } catch { decoded = seg; }
    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("://") ||
      decoded.includes("\0") ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      return fail(res, 400, "Invalid GitHub API path");
    }
    clean.push(encodeURIComponent(decoded));
  }
  const joinedPath = clean.join("/");

  // Rebuild the query string, dropping the injected helper key.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "githubPath") continue;
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else if (value != null) params.append(key, String(value));
  }
  const search = params.toString();

  const targetUrl = `${GITHUB_API}/${joinedPath}${search ? `?${search}` : ""}`;

  let body;
  try {
    body = await readBody(req, 1024 * 1024);
  } catch (e) {
    return fail(res, e.status || 400, e.message || "Bad request");
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: buildUpstreamHeaders(req),
      body,
      redirect: "manual"
    });

    copyUpstreamHeaders(upstream, res);

    const { mode } = resolveAuth(req);
    res.setHeader("X-Playground-Auth-Mode", mode);
    res.setHeader("X-Playground-Proxy", "jafhub-full");
    res.setHeader("X-Playground-Path", joinedPath);

    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error("[github proxy]", error);
    return fail(res, 502, "Unable to reach GitHub API", { error: error.message });
  }
}
