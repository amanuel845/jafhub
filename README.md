# jafhub-full

A compact GitHub **REST + GraphQL API playground** designed for Vercel, with
dual server/client token support and a hardened proxy layer.

Version 3 merges the best of `jafhub-v1` and `jafhub-v2`:

- **v1's security posture** — method allowlist, header allowlist, body caps, no arbitrary upstream, optional server-side token.
- **v2's routing & UI** — nested catch-all REST route, dedicated GraphQL and meta endpoints, tabbed IDE, endpoint catalog, history, cURL, docs page.

## Features

- REST proxy: `GET / POST / PUT / PATCH / DELETE / HEAD`
- GraphQL proxy: `POST /api/graphql`
- Meta endpoint: `GET /api/meta` (auth mode, version, upstream)
- Auth priority: client PAT → server `GITHUB_TOKEN` → public
- Response header passthrough: rate-limit, request-ID, ETag, Link, Retry-After, deprecation/sunset
- `X-Playground-Auth-Mode` on every proxy response
- Allowlisted request & response headers
- Path validation (`..`, `://`, `\0` rejected)
- Body caps: 1 MB (REST), 256 KB (GraphQL)
- Optional CORS allowlist via `ALLOWED_ORIGINS`
- Tabbed UI: REST Explorer, GraphQL, Rate & Usage, History, About
- Endpoint catalog, custom paths, JSON formatter, raw/pretty toggle, cURL generator
- Standalone docs page at `/docs.html`

## Project layout
