// api/github/[...path].js
import {
  GITHUB_API,
  ALLOWED_METHODS,
  applyCors,
  buildUpstreamHeaders,
  copyUpstreamHeaders,
  fail,
  normalizePath,
  readBody,
  resolveAuth
} from "../_lib/github.js";

export default async function handler(req, res) {
  applyCors(req, res);

  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return res.status(204).end();
  }

  if (!ALLOWED_METHODS.has(method)) {
    res.setHeader("Allow", [...ALLOWED_METHODS].join(", "));
    return fail(res, 405, "Method not allowed", { allowed: [...ALLOWED_METHODS] });
  }

  let joinedPath;
  try {
    joinedPath = normalizePath(req.query?.path);
  } catch (e) {
    return fail(res, e.status || 400, e.message || "Invalid path");
  }

  // Forward query params from the original request URL, excluding the
  // framework-injected catch-all key.
  let search = "";
  try {
    const incoming = new URL(req.url, "http://localhost");
    const params = new URLSearchParams(incoming.search);
    params.delete("path");
    search = params.toString();
  } catch {
    search = "";
  }

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

    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error("[github proxy]", error);
    return fail(res, 502, "Unable to reach GitHub API", {
      error: error.message,
      documentation_url: "https://docs.github.com/en/rest"
    });
  }
}
