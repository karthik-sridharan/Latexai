/* Latexai Step 3 GitHub Sync UI
 * Stage: latex-stage3-github-sync-foundation-20260518-1
 *
 * Drop this file at: js/lai-github-sync-ui.js
 * Requires backend service with /api/lumina/github routes.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3-github-sync-foundation-20260518-1";
  var SETTINGS_KEY = "latexai.step3.github.settings.v1";
  var root = typeof window !== "undefined" ? window : globalThis;

  function defaultSettings() {
    return {
      backendBase: "https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github",
      owner: "",
      repo: "",
      branch: "main",
      rootPath: "",
      autosaveCommits: false,
      autosaveCommitMs: 120000,
      lastCommitSha: null
    };
  }

  function loadSettings() {
    try {
      return Object.assign(defaultSettings(), JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
    } catch (_) {
      return defaultSettings();
    }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "style") Object.assign(el.style, attrs[k]);
      else if (k === "text") el.textContent = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }

  async function apiFetch(path, body) {
    var settings = loadSettings();
    var url = settings.backendBase.replace(/\/$/, "") + path;
    var opts = {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" }
    };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    var text = await res.text();
    var data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { ok: false, raw: text }; }
    if (!res.ok) {
      var msg = data.detail || data.message || ("HTTP " + res.status);
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function currentProjectPayload() {
    var storage = root.LAI_STORAGE;
    if (!storage || typeof storage.discoverProject !== "function") {
      throw new Error("LAI_STORAGE.discoverProject is not available.");
    }
    return storage.discoverProject();
  }

  function showMessage(el, msg) {
    el.textContent = msg;
  }

  function init() {
    if (document.getElementById("lai-github-sync-panel")) return;

    var settings = loadSettings();

    var panel = h("div", {
      id: "lai-github-sync-panel",
      style: {
        position: "fixed", left: "12px", bottom: "12px", zIndex: "999998",
        width: "315px", maxHeight: "75vh", overflow: "auto",
        background: "rgba(255,255,255,0.97)", color: "#111",
        border: "1px solid #bbb", borderRadius: "10px",
        boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
        font: "13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: "10px"
      }
    });

    function labelInput(label, value, placeholder) {
      var input = h("input", {
        type: "text",
        value: value || "",
        placeholder: placeholder || "",
        style: { width: "100%", boxSizing: "border-box", marginTop: "2px", marginBottom: "6px", padding: "5px", border: "1px solid #aaa", borderRadius: "6px" }
      });
      var wrap = h("label", { style: { display: "block", fontSize: "12px", fontWeight: "600" } }, [
        document.createTextNode(label),
        input
      ]);
      return { wrap: wrap, input: input };
    }

    function btn(label) {
      return h("button", {
        type: "button",
        style: {
          margin: "2px", padding: "5px 7px", borderRadius: "7px",
          border: "1px solid #aaa", background: "#f7f7f7", color: "#111",
          font: "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        },
        text: label
      });
    }

    var title = h("div", { text: "GitHub Sync", style: { fontWeight: "700", marginBottom: "6px" } });
    var backend = labelInput("GitHub backend URL", settings.backendBase, "https://.../api/lumina/github");
    var owner = labelInput("Owner / org", settings.owner, "karthik-sridharan");
    var repo = labelInput("Repo", settings.repo, "my-paper");
    var branch = labelInput("Branch", settings.branch, "main");
    var rootPath = labelInput("Folder path in repo", settings.rootPath, "papers/project1 or blank");

    var status = h("div", { style: { whiteSpace: "pre-wrap", lineHeight: "1.35", margin: "6px 0" }, text: "Not checked." });
    var checkBtn = btn("Check backend");
    var loadBtn = btn("Load from GitHub");
    var commitBtn = btn("Commit Now");
    var hideBtn = btn("Hide");

    function pullForm() {
      settings.backendBase = backend.input.value.trim();
      settings.owner = owner.input.value.trim();
      settings.repo = repo.input.value.trim();
      settings.branch = branch.input.value.trim() || "main";
      settings.rootPath = rootPath.input.value.trim().replace(/^\/+|\/+$/g, "");
      saveSettings(settings);
      return settings;
    }

    [backend.input, owner.input, repo.input, branch.input, rootPath.input].forEach(function (inp) {
      inp.addEventListener("change", pullForm);
      inp.addEventListener("blur", pullForm);
    });

    checkBtn.addEventListener("click", async function () {
      try {
        pullForm();
        showMessage(status, "Checking backend...");
        var r = await apiFetch("/status");
        showMessage(status, "Backend: " + (r.ok ? "online" : "not ok") + "\nToken: " + (r.githubTokenConfigured ? "configured" : "missing") + "\nStage: " + (r.stage || ""));
      } catch (err) {
        showMessage(status, "Backend check failed:\n" + (err.message || err));
      }
    });

    loadBtn.addEventListener("click", async function () {
      try {
        var s = pullForm();
        if (!s.owner || !s.repo) throw new Error("Owner and repo are required.");
        showMessage(status, "Loading project from GitHub...");
        var r = await apiFetch("/load-project", {
          owner: s.owner, repo: s.repo, branch: s.branch, rootPath: s.rootPath
        });
        if (!r.ok || !r.project) throw new Error(r.message || "No project returned.");
        if (!root.LAI_STORAGE || typeof root.LAI_STORAGE.applyProject !== "function") {
          throw new Error("Storage provider cannot apply project.");
        }
        root.LAI_STORAGE.applyProject(r.project);
        await root.LAI_STORAGE.saveNow();
        settings.lastCommitSha = r.headSha || null;
        saveSettings(settings);
        showMessage(status, "Loaded " + Object.keys(r.project.files || {}).length + " files.\nRoot: " + r.project.rootFile + "\nHEAD: " + (r.headSha || "unknown"));
      } catch (err) {
        showMessage(status, "Load failed:\n" + (err.message || err));
      }
    });

    commitBtn.addEventListener("click", async function () {
      try {
        var s = pullForm();
        if (!s.owner || !s.repo) throw new Error("Owner and repo are required.");
        var project = currentProjectPayload();
        showMessage(status, "Creating GitHub commit...");
        var r = await apiFetch("/autosave-commit", {
          owner: s.owner,
          repo: s.repo,
          branch: s.branch,
          rootPath: s.rootPath,
          expectedHeadSha: settings.lastCommitSha || null,
          message: "Latexai manual save: " + new Date().toISOString(),
          project: project,
          files: project.files
        });
        settings.lastCommitSha = r.commitSha || null;
        saveSettings(settings);
        showMessage(status, "Committed.\nCommit: " + (r.commitSha || "unknown") + "\nFiles: " + (r.fileCount || 0));
      } catch (err) {
        showMessage(status, "Commit failed:\n" + (err.message || err));
      }
    });

    hideBtn.addEventListener("click", function () {
      panel.style.display = "none";
      var reopen = btn("GitHub");
      reopen.id = "lai-github-sync-reopen";
      Object.assign(reopen.style, { position: "fixed", left: "12px", bottom: "12px", zIndex: "999998", borderRadius: "999px", background: "#fff" });
      reopen.addEventListener("click", function () { panel.style.display = ""; reopen.remove(); });
      document.body.appendChild(reopen);
    });

    panel.appendChild(title);
    panel.appendChild(backend.wrap);
    panel.appendChild(owner.wrap);
    panel.appendChild(repo.wrap);
    panel.appendChild(branch.wrap);
    panel.appendChild(rootPath.wrap);
    panel.appendChild(h("div", {}, [checkBtn, loadBtn, commitBtn, hideBtn]));
    panel.appendChild(status);
    document.body.appendChild(panel);
  }

  root.LAI_GITHUB_SYNC = {
    STAGE: STAGE,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    apiFetch: apiFetch
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  console.log("[Latexai GitHub Sync]", STAGE);
})();
