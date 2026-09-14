// api/meta.js
import {
  GITHUB_API,
  GITHUB_API_VERSION,
  applyCors,
  fail
} from "./_lib/github.js";

export default async function handler(req, res) {
  applyCors(req, res);

  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return res.status(204).end();
  if (method !== "GET" && method !== "HEAD") {
    return fail(res, 405, "Method not allowed");
  }

  const authMode = process.env.GITHUB_TOKEN ? "server" : "public";
  const corsOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return res.status(200).json({
    name: "jafhub-full",
    version: "3.0.0",
    upstream: GITHUB_API,
    githubApiVersion: GITHUB_API_VERSION,
    authMode,
    corsOrigins: corsOrigins.length ? corsOrigins : ["<same-origin>"],
    capabilities: {
      rest: true,
      graphql: true,
      serverToken: authMode === "server",
      clientTokenOverride: true
    },
    timestamp: new Date().toISOString()
  });
}
