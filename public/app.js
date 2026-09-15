// public/app.js
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // Catalog uses {user} and {repo} tokens. They are substituted with the
  // values from the Account dialog before the path is placed in the input.
  const GROUPS = [
    ["Core", [
      ["GET", "/", "API root"],
      ["GET", "/user", "Authenticated user"],
      ["GET", "/rate_limit", "Rate limits"],
      ["GET", "/users/{user}", "Public user"],
      ["GET", "/users/{user}/repos", "User repositories"],
      ["GET", "/user/repos", "My repositories"]
    ]],
    ["Repositories", [
      ["GET", "/repos/{user}/{repo}", "Repository"],
      ["GET", "/repos/{user}/{repo}/branches", "Branches"],
      ["GET", "/repos/{user}/{repo}/commits", "Commits"],
      ["GET", "/repos/{user}/{repo}/contents/README.md", "File contents"],
      ["GET", "/repos/{user}/{repo}/releases", "Releases"],
      ["GET", "/repos/{user}/{repo}/tags", "Tags"],
      ["GET", "/repos/{user}/{repo}/collaborators", "Collaborators"],
      ["GET", "/repos/{user}/{repo}/contributors", "Contributors"],
      ["GET", "/repos/{user}/{repo}/deployments", "Deployments"],
      ["GET", "/repos/{user}/{repo}/environments", "Environments"],
      ["GET", "/repos/{user}/{repo}/hooks", "Webhooks"]
    ]],
    ["Issues & PRs", [
      ["GET", "/repos/{user}/{repo}/issues", "Issues"],
      ["POST", "/repos/{user}/{repo}/issues", "Create issue"],
      ["GET", "/repos/{user}/{repo}/issues/1", "Issue"],
      ["PATCH", "/repos/{user}/{repo}/issues/1", "Update issue"],
      ["GET", "/repos/{user}/{repo}/pulls", "Pull requests"],
      ["GET", "/repos/{user}/{repo}/pulls/1", "Pull request"],
      ["PATCH", "/repos/{user}/{repo}/pulls/1", "Update pull request"],
      ["GET", "/repos/{user}/{repo}/pulls/1/files", "PR files"],
      ["GET", "/repos/{user}/{repo}/pulls/1/commits", "PR commits"]
    ]],
    ["Search", [
      ["GET", "/search/repositories?q=javascript", "Repositories"],
      ["GET", "/search/code?q=TODO+repo:{user}/{repo}", "Code"],
      ["GET", "/search/issues?q=is:open+repo:{user}/{repo}", "Issues"],
      ["GET", "/search/users?q={user}", "Users"],
      ["GET", "/search/commits?q=fix", "Commits"]
    ]],
    ["Organizations", [
      ["GET", "/user/orgs", "My organizations"],
      ["GET", "/orgs/{user}", "Organization"],
      ["GET", "/orgs/{user}/repos", "Org repositories"],
      ["GET", "/orgs/{user}/members", "Members"],
      ["GET", "/orgs/{user}/teams", "Teams"]
    ]],
    ["Actions", [
      ["GET", "/repos/{user}/{repo}/actions/runs", "Workflow runs"],
      ["GET", "/repos/{user}/{repo}/actions/workflows", "Workflows"],
      ["GET", "/repos/{user}/{repo}/actions/artifacts", "Artifacts"],
      ["POST", "/repos/{user}/{repo}/actions/workflows/WORKFLOW_ID/dispatches", "Dispatch workflow"]
    ]],
    ["Gists & Notifications", [
      ["GET", "/gists", "My gists"],
      ["GET", "/gists/public", "Public gists"],
      ["GET", "/gists/GIST_ID", "Gist"],
      ["GET", "/notifications", "Notifications"]
    ]],
    ["Git Data", [
      ["GET", "/repos/{user}/{repo}/git/refs/heads/main", "Git ref"],
      ["GET", "/repos/{user}/{repo}/git/trees/main?recursive=1", "Git tree"],
      ["GET", "/repos/{user}/{repo}/git/commits/COMMIT_SHA", "Git commit"],
      ["GET", "/repos/{user}/{repo}/git/blobs/BLOB_SHA", "Git blob"]
    ]],
    ["Packages & Security", [
      ["GET", "/users/{user}/packages", "User packages"],
      ["GET", "/orgs/{user}/packages", "Org packages"],
      ["GET", "/repos/{user}/{repo}/vulnerability-alerts", "Vulnerability alerts"],
      ["GET", "/repos/{user}/{repo}/code-scanning/alerts", "Code scanning alerts"],
      ["GET", "/repos/{user}/{repo}/secret-scanning/alerts", "Secret scanning alerts"]
    ]]
  ];

  let raw = false;
  let count = Number(sessionStorage.getItem("gh_count") || 0);
  let meta = { authMode: "public", version: "unknown" };

  // ---------- Account (configurable) ----------

  const getAccount = () => ({
    user: (localStorage.getItem("gh_user") || "").trim(),
    repo: (localStorage.getItem("gh_repo") || "").trim()
  });

  function substituteTokens(path) {
    const { user, repo } = getAccount();
    return String(path)
      .replaceAll("{user}", user || "{user}")
      .replaceAll("{repo}", repo || "{repo}");
  }

  function hasUnresolvedTokens(path) {
    return /\{user\}|\{repo\}/.test(path);
  }

  function renderAccount() {
    const { user, repo } = getAccount();
    const label = user ? (repo ? `${user}/${repo}` : user) : "not set";
    $("acctName").textContent = label;
  }

  // ---------- Preset dropdown ----------

  const presetValue = (method, path) => `${method} ${path}`;

  function buildPresetDropdown() {
    const sel = $("preset");
    if (!sel) return;

    sel.innerHTML = '<option value="">— Select an endpoint —</option>';

    for (const [groupName, endpoints] of GROUPS) {
      const og = document.createElement("optgroup");
      og.label = groupName;
      for (const [method, path, label] of endpoints) {
        const opt = document.createElement("option");
        opt.value = presetValue(method, path);   // keeps tokens
        opt.textContent = label;                 // label only
        opt.dataset.label = label;
        opt.title = `${method} ${substituteTokens(path)}`;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }

    sel.addEventListener("change", () => {
      const v = sel.value;
      if (!v) return;
      const sp = v.indexOf(" ");
      if (sp < 1) return;
      const method = v.slice(0, sp);
      const tokenized = v.slice(sp + 1);
      const resolved = substituteTokens(tokenized);

      $("method").value = method;
      $("path").value = resolved;
      $("path").focus();
      $("path").setSelectionRange(resolved.length, resolved.length);

      if (hasUnresolvedTokens(resolved)) {
        $("reqStatus").textContent =
          "Set your account (top-right) to fill {user}/{repo}.";
      } else {
        $("reqStatus").textContent = "Ready.";
      }
    });
  }

  // Re-select the option whose resolved form matches what's in the path input.
  function syncPresetSelection() {
    const sel = $("preset");
    if (!sel) return;
    const method = $("method").value;
    const path = $("path").value.trim();

    let match = "";
    for (const opt of sel.options) {
      const sp = opt.value.indexOf(" ");
      if (sp < 1) continue;
      if (opt.value.slice(0, sp) !== method) continue;
      if (substituteTokens(opt.value.slice(sp + 1)) === path) {
        match = opt.value;
        break;
      }
    }
    sel.value = match;
  }

  // Refresh dropdown labels when the account changes.
  function refreshPresetLabels() {
    const sel = $("preset");
    if (!sel) return;
    for (const og of sel.querySelectorAll("optgroup")) {
      for (const opt of og.children) {
        const v = opt.value;
        const sp = v.indexOf(" ");
        if (sp < 1) continue;
        const tokenized = v.slice(sp + 1);
        const label = opt.dataset.label || tokenized;
        opt.textContent = label;
        opt.title = `${v.slice(0, sp)} ${substituteTokens(tokenized)}`;
      }
    }
    syncPresetSelection();
  }

  // ---------- Auth ----------

  const getToken = () => localStorage.getItem("github_token") || "";

  function currentAuthMode() {
    if (getToken()) return "client";
    if (meta.authMode === "server") return "server";
    return "public";
  }

  function renderAuth() {
    const m = currentAuthMode();
    const el = $("authState");
    el.className = "authstate " + m;
    el.textContent =
      m === "client" ? "● client token" :
      m === "server" ? "● server token" :
      "● public";

    const help = $("authHelp");
    if (!help) return;
    if (meta.authMode === "server") {
      help.textContent =
        "A server token is configured. Entering your own PAT overrides it " +
        "for your requests only.";
    } else {
      help.textContent =
        "No server token configured. Enter a fine-grained PAT to authenticate. " +
        "Stored in this browser's localStorage only.";
    }
  }

  async function loadMeta() {
    try {
      const r = await fetch("/api/meta");
      if (r.ok) meta = await r.json();
    } catch {}
    renderAuth();
  }

  // ---------- Sidebar ----------

  function buildSidebar() {
    const s = $("side");
    const search = document.createElement("input");
    search.className = "search";
    search.placeholder = "Filter endpoints…";
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll(".ep").forEach((el) => {
        el.style.display = el.dataset.x.includes(q) ? "flex" : "none";
      });
    });
    s.appendChild(search);

    for (const [groupName, endpoints] of GROUPS) {
      const wrap = document.createElement("div");
      wrap.className = "grp";
      const h = document.createElement("h3");
      h.textContent = groupName;
      wrap.appendChild(h);

      for (const [method, path, label] of endpoints) {
        const b = document.createElement("button");
        b.className = "ep";
        b.dataset.x = `${method} ${path} ${label}`.toLowerCase();
        b.innerHTML =
          `<span class="method ${method}">${method}</span>` +
          `<small>${label}</small>`;
        b.addEventListener("click", () => {
          const resolved = substituteTokens(path);
          $("method").value = method;
          $("path").value = resolved;
          syncPresetSelection();
          if (hasUnresolvedTokens(resolved)) {
            $("reqStatus").textContent =
              "Set your account (top-right) to fill {user}/{repo}.";
          }
        });
        wrap.appendChild(b);
      }
      s.appendChild(wrap);
    }
  }

  // ---------- Request helpers ----------

  function requestHeaders() {
    const h = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const t = getToken();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function pretty(text) {
    try { return JSON.stringify(JSON.parse(text), null, 2); }
    catch { return text; }
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  function updateRatePanel(headers) {
    const r = headers.get("x-ratelimit-remaining");
    const l = headers.get("x-ratelimit-limit");
    const u = headers.get("x-ratelimit-used");
    const res = headers.get("x-ratelimit-resource");

    $("rate").textContent = `Rate ${r ?? "—"}/${l ?? "—"} • ${res || "core"}`;
    $("remain").textContent = r ?? "—";
    $("limit").textContent = l ?? "—";
    $("used").textContent = u ?? "—";
    $("resource").textContent = res ?? "—";
  }

  // ---------- History ----------

  function recordHistory(method, path, status, latencyMs) {
    count += 1;
    sessionStorage.setItem("gh_count", String(count));
    $("count").textContent = count;

    const list = JSON.parse(sessionStorage.getItem("gh_history") || "[]");
    list.unshift({
      id: Date.now() + Math.random(),
      m: method,
      p: path,
      status,
      lat: latencyMs,
      at: new Date().toISOString()
    });
    sessionStorage.setItem("gh_history", JSON.stringify(list.slice(0, 80)));
    renderHistory();
  }

  function renderHistory() {
    const list = JSON.parse(sessionStorage.getItem("gh_history") || "[]");
    const el = $("history");

    if (!list.length) {
      el.innerHTML = '<div style="padding:12px" class="muted">No requests yet.</div>';
      return;
    }

    el.innerHTML = list.map((x) =>
      `<div class="hi" data-id="${x.id}">` +
        `<b>${x.m}</b> <code>${esc(x.p)}</code> ` +
        `<span class="${x.status >= 200 && x.status < 300 ? "ok" : "bad"}">HTTP ${x.status}</span>` +
        `<small class="muted"> · ${x.lat}ms</small>` +
      `</div>`
    ).join("");

    el.querySelectorAll(".hi").forEach((row) => {
      row.addEventListener("click", () => {
        const item = list.find((z) => String(z.id) === row.dataset.id);
        if (!item) return;
        $("method").value = item.m;
        $("path").value = item.p;
        syncPresetSelection();
        view("rest");
      });
    });
  }

  // ---------- REST ----------

  async function sendRest() {
    let path = $("path").value.trim();
    if (!path.startsWith("/")) path = "/" + path;

    if (hasUnresolvedTokens(path)) {
      $("out").innerHTML =
        '<span class="bad">Path still contains {user}/{repo}. ' +
        'Open Account (top-right) to set them.</span>';
      $("reqStatus").textContent = "Account not configured.";
      $("resStatus").textContent = "—";
      return;
    }

    const method = $("method").value;
    const needsBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    let payload;

    if (needsBody && $("body").value.trim()) {
      try {
        payload = JSON.stringify(JSON.parse($("body").value));
      } catch {
        $("out").innerHTML = '<span class="bad">Invalid JSON request body.</span>';
        $("resStatus").textContent = "Parse error";
        return;
      }
    }

    $("send").disabled = true;
    $("out").textContent = "Loading…";
    $("reqStatus").textContent = `Sending ${method} ${path}`;

    const started = performance.now();
    try {
      const r = await fetch("/api/github" + path, {
        method,
        headers: requestHeaders(),
        body: payload
      });
      const text = await r.text();
      const latency = Math.round(performance.now() - started);

      updateRatePanel(r.headers);
      recordHistory(method, path, r.status, latency);

      $("last").textContent = r.status;
      $("out").innerHTML =
        `<div class="${r.ok ? "ok" : "bad"}">HTTP ${r.status} ${esc(r.statusText)}</div>\n` +
        esc(raw ? text : pretty(text));

      const reqId = r.headers.get("x-github-request-id") || "—";
      const authMode = r.headers.get("x-playground-auth-mode") || "—";
      $("resStatus").textContent = `${latency} ms · ${reqId} · auth:${authMode}`;
      $("reqStatus").textContent = "Done.";
    } catch (e) {
      $("out").textContent = e.message || String(e);
      $("resStatus").textContent = "Network error";
      $("reqStatus").textContent = "Failed.";
    } finally {
      $("send").disabled = false;
    }
  }

  function buildCurl() {
    let path = $("path").value.trim();
    if (!path.startsWith("/")) path = "/" + path;

    const method = $("method").value;
    let cmd =
      `curl -X ${method} "${location.origin}/api/github${path}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `-H "X-GitHub-Api-Version: 2022-11-28"`;

    if (getToken()) cmd += ` -H "Authorization: Bearer YOUR_GITHUB_TOKEN"`;

    const body = $("body").value.trim();
    if (body) {
      cmd += ` -H "Content-Type: application/json" --data '${body.replaceAll("'", "'\\''")}'`;
    }
    return cmd;
  }

  // ---------- GraphQL ----------

  async function runGraphQL() {
    let variables = {};
    try {
      variables = JSON.parse($("gVars").value || "{}");
    } catch {
      $("gOut").textContent = "Invalid variables JSON.";
      return;
    }

    $("gRun").disabled = true;
    $("gOut").textContent = "Running…";

    const started = performance.now();
    try {
      const r = await fetch("/api/graphql", {
        method: "POST",
        headers: { ...requestHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          query: $("gQuery").value,
          variables
        })
      });
      const text = await r.text();
      const latency = Math.round(performance.now() - started);

      updateRatePanel(r.headers);
      recordHistory("GQL", "/graphql", r.status, latency);

      $("gOut").textContent = pretty(text);
      $("gStatus").textContent =
        `HTTP ${r.status} · ${latency} ms · auth:${r.headers.get("x-playground-auth-mode") || "—"}`;
    } catch (e) {
      $("gOut").textContent = e.message || String(e);
      $("gStatus").textContent = "Network error";
    } finally {
      $("gRun").disabled = false;
    }
  }

  // ---------- Tabs ----------

  function view(name) {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.v === name));
    document.querySelectorAll(".view").forEach((v) =>
      v.classList.toggle("active", v.id === "v-" + name));
  }

  // ---------- Wiring ----------

  function wire() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => view(t.dataset.v)));

    $("send").addEventListener("click", sendRest);
    $("path").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendRest();
    });

    $("method").addEventListener("change", syncPresetSelection);
    $("path").addEventListener("input", syncPresetSelection);

    $("fmt").addEventListener("click", () => {
      try { $("body").value = JSON.stringify(JSON.parse($("body").value), null, 2); }
      catch { alert("Invalid JSON"); }
    });
    $("clearBody").addEventListener("click", () => { $("body").value = ""; });

    $("raw").addEventListener("click", () => { raw = !raw; sendRest(); });
    $("copy").addEventListener("click", () => {
      navigator.clipboard?.writeText($("out").textContent);
    });

    $("snippet").addEventListener("click", () => {
      $("snip").value = buildCurl();
      $("snipModal").classList.add("open");
    });
    $("closeSnip").addEventListener("click", () =>
      $("snipModal").classList.remove("open"));
    $("copySnip").addEventListener("click", () =>
      navigator.clipboard?.writeText($("snip").value));

    // Account
    $("acctBtn").addEventListener("click", () => {
      const { user, repo } = getAccount();
      $("acctUser").value = user;
      $("acctRepo").value = repo;
      $("acctModal").classList.add("open");
    });
    $("acctCancel").addEventListener("click", () =>
      $("acctModal").classList.remove("open"));
    $("acctClear").addEventListener("click", () => {
      localStorage.removeItem("gh_user");
      localStorage.removeItem("gh_repo");
      $("acctUser").value = "";
      $("acctRepo").value = "";
      renderAccount();
      refreshPresetLabels();
      $("acctModal").classList.remove("open");
    });
    $("acctSave").addEventListener("click", () => {
      const u = $("acctUser").value.trim();
      const r = $("acctRepo").value.trim();
      if (u) localStorage.setItem("gh_user", u);
      else localStorage.removeItem("gh_user");
      if (r) localStorage.setItem("gh_repo", r);
      else localStorage.removeItem("gh_repo");
      renderAccount();
      refreshPresetLabels();
      $("acctModal").classList.remove("open");
    });

    // Auth
    $("authBtn").addEventListener("click", () => {
      $("token").value = getToken();
      renderAuth();
      $("authModal").classList.add("open");
    });
    $("cancelAuth").addEventListener("click", () =>
      $("authModal").classList.remove("open"));
    $("clearAuth").addEventListener("click", () => {
      localStorage.removeItem("github_token");
      $("token").value = "";
      renderAuth();
      $("authModal").classList.remove("open");
    });
    $("saveAuth").addEventListener("click", () => {
      const v = $("token").value.trim();
      if (v) localStorage.setItem("github_token", v);
      else localStorage.removeItem("github_token");
      renderAuth();
      $("authModal").classList.remove("open");
    });

    $("clearHistory").addEventListener("click", () => {
      sessionStorage.removeItem("gh_history");
      renderHistory();
    });

    $("gRun").addEventListener("click", runGraphQL);
    $("gExample").addEventListener("click", () => {
      $("gQuery").value =
`query Viewer($first: Int!) {
  viewer {
    login
    name
    repositories(first: $first) {
      nodes { nameWithOwner stargazerCount url }
    }
  }
}`;
      $("gVars").value = JSON.stringify({ first: 5 }, null, 2);
    });
    $("gCopy").addEventListener("click", () =>
      navigator.clipboard?.writeText($("gOut").textContent));

    document.querySelectorAll(".modal").forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.classList.remove("open");
      });
    });
  }

  // ---------- Boot ----------

  document.addEventListener("DOMContentLoaded", async () => {
    buildSidebar();
    buildPresetDropdown();
    wire();
    renderHistory();
    renderAccount();
    syncPresetSelection();
    $("count").textContent = count;
    $("gExample").click();
    await loadMeta();
  });
})();
