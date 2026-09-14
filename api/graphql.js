// api/graphql.js
import {
  GITHUB_GRAPHQL,
  applyCors,
  buildUpstreamHeaders,
  copyUpstreamHeaders,
  fail,
  readBody,
  resolveAuth
} from "./_lib/github.js";

const MAX_BODY = 256 * 1024;

export default async function handler(req, res) {
  applyCors(req, res);

  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") return res.status(204).end();
  if (method !== "POST") return fail(res, 405, "Use POST for GraphQL.");

  let raw;
  try {
    raw = await readBody(req, MAX_BODY);
  } catch (e) {
    return fail(res, e.status || 400, e.message || "Bad request");
  }

  let payload;
  try {
    payload = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {});
  } catch {
    return fail(res, 400, "Request body is not valid JSON.");
  }

  if (!payload || typeof payload.query !== "string" || !payload.query.trim()) {
    return fail(res, 400, "GraphQL `query` string is required.");
  }

  const upstreamBody = JSON.stringify({
    query: payload.query,
    variables: payload.variables && typeof payload.variables === "object"
      ? payload.variables
      : {},
    operationName: typeof payload.operationName === "string"
      ? payload.operationName
      : undefined
  });

  try {
    const upstream = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: buildUpstreamHeaders(req, { json: true }),
      body: upstreamBody
    });

    copyUpstreamHeaders(upstream, res);

    const { mode } = resolveAuth(req);
    res.setHeader("X-Playground-Auth-Mode", mode);
    res.setHeader("X-Playground-Proxy", "jafhub-full");

    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error("[graphql proxy]", error);
    return fail(res, 502, "Unable to reach GitHub GraphQL API", {
      error: error.message
    });
  }
}
