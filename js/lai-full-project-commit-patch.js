/* Latexai Step 3B Full Project Commit Patch
 * Stage: latex-stage3b-full-project-commit-20260518-1
 *
 * This patch fixes GitHub commits that only include the active editor file.
 * It wraps LAI_STORAGE.discoverProject() so it aggressively harvests every
 * known project file from:
 *   - loaded GitHub project in LAI_STORAGE/currentProject
 *   - app globals
 *   - localStorage project records
 *   - active editor (#sourceEditor)
 *
 * It also adds a separate "GitHub Full Commit" panel that commits all
 * discovered files, including files in subdirectories and newly added files
 * once the app has stored them.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3b-full-project-commit-20260518-1";
  var SETTINGS_KEY = "latexai.step3.github.settings.v1";
  var root = typeof window !== "undefined" ? window : globalThis;

  var TEXT_EXT_RE = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i;
  var ASSET_EXT_RE = /\.(png|jpg|jpeg|pdf|svg|eps)$/i;
  var KEY_RE = /(lumina|latex|latexai|project|editor|file|store)/i;

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function normPath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  function validPath(path) {
    path = normPath(path);
    return path &&
      !/^\//.test(path) &&
      !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      (TEXT_EXT_RE.test(path) || ASSET_EXT_RE.test(path));
  }

  function textFrom(v) {
    if (typeof v === "string") return v;
    if (!v || typeof v !== "object") return null;
    var keys = ["content", "text", "source", "value", "data", "body"];
    for (var i = 0; i < keys.length; i++) {
      if (typeof v[keys[i]] === "string") return v[keys[i]];
    }
    return null;
  }

  function addFile(out, path, value) {
    path = normPath(path);
    var text = textFrom(value);
    if (validPath(path) && typeof text === "string") out[path] = text;
  }

  function collectFilesLike(out, filesLike) {
    if (!filesLike) return;
    if (Array.isArray(filesLike)) {
      filesLike.forEach(function (f) {
        if (!f || typeof f !== "object") return;
        addFile(out, f.path || f.name || f.filename || f.filePath || f.relativePath, f);
      });
      return;
    }
    if (typeof filesLike === "object") {
      Object.keys(filesLike).forEach(function (path) {
        var v = filesLike[path];
        if (typeof v === "string") addFile(out, path, v);
        else if (v && typeof v === "object") addFile(out, v.path || v.name || v.filename || path, v);
      });
    }
  }

  function scanObj(obj, out, meta, maxDepth) {
    var seen = new WeakSet();
    function walk(x, depth) {
      if (!x || typeof x !== "object" || depth > maxDepth || seen.has(x)) return;
      seen.add(x);

      if (typeof x.rootFile === "string") meta.rootFile = normPath(x.rootFile) || meta.rootFile;
      if (typeof x.mainFile === "string") meta.rootFile = normPath(x.mainFile) || meta.rootFile;
      if (typeof x.activePath === "string") meta.activePath = normPath(x.activePath) || meta.activePath;

      ["files", "fileMap", "sources", "documents", "buffers", "projectFiles"].forEach(function (k) {
        collectFilesLike(out, x[k]);
      });

      Object.keys(x).forEach(function (k) {
        if (validPath(k)) addFile(out, k, x[k]);
      });

      if (depth >= maxDepth) return;
      Object.keys(x).forEach(function (k) {
        if (/(project|file|store|state|model|buffer|source|doc|latex|lumina|editor)/i.test(k)) {
          try { walk(x[k], depth + 1); } catch (_) {}
        }
      });
    }
    try { walk(obj, 0); } catch (_) {}
  }

  function scanLocalStorage(out, meta) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!KEY_RE.test(key || "")) continue;
        var obj = safeJson(localStorage.getItem(key), null);
        if (obj && typeof obj === "object") scanObj(obj, out, meta, 7);
      }
    } catch (_) {}
  }

  function activePathFromDom(fallback) {
    var pill = document.getElementById("activeFilePill");
    var v = pill && pill.textContent ? pill.textContent.trim() : "";
    return normPath(v || fallback || "main.tex");
  }

  function editorText() {
    var ta = document.getElementById("sourceEditor") || document.querySelector("textarea");
    return ta && typeof ta.value === "string" ? ta.value : "";
  }

  function inferRoot(files, fallback) {
    fallback = normPath(fallback || "");
    if (fallback && files[fallback]) return fallback;
    if (files["main.tex"]) return "main.tex";
    var tex = Object.keys(files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
    return tex[0] || fallback || "main.tex";
  }

  function harvestFullProject(originalProject) {
    var files = {};
    var meta = { rootFile: "main.tex", activePath: "main.tex" };

    if (originalProject) {
      if (originalProject.rootFile) meta.rootFile = normPath(originalProject.rootFile);
      if (originalProject.activePath) meta.activePath = normPath(originalProject.activePath);
      collectFilesLike(files, originalProject.files);
    }

    [
      root.currentProject,
      root.project,
      root.LatexaiProject,
      root.AppState,
      root.ProjectStore,
      root.ProjectModel,
      root.LuminaLatex,
      root.NS
    ].forEach(function (obj) { scanObj(obj, files, meta, 6); });

    scanLocalStorage(files, meta);

    var activePath = activePathFromDom(meta.activePath);
    var txt = editorText();
    if (txt && txt.trim()) files[activePath] = txt;

    var rootFile = inferRoot(files, meta.rootFile);
    if (!files[rootFile] && files[activePath]) files[rootFile] = files[activePath];

    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: (originalProject && originalProject.name) || "Project",
      projectId: originalProject && originalProject.projectId || null,
      rootFile: rootFile,
      activePath: activePath,
      files: files,
      savedAt: new Date().toISOString(),
      fullCommitFileCount: Object.keys(files).length
    };
  }

  function patchStorage() {
    if (!root.LAI_STORAGE || root.LAI_STORAGE.__fullCommitPatched) return false;
    var storage = root.LAI_STORAGE;
    var originalDiscover = typeof storage.discoverProject === "function" ? storage.discoverProject.bind(storage) : function () { return {}; };

    storage.discoverProject = function () {
      var base = {};
      try { base = originalDiscover() || {}; } catch (_) {}
      return harvestFullProject(base);
    };

    storage.fullCommitDiagnostics = function () {
      var p = storage.discoverProject();
      return {
        ok: true,
        stage: STAGE,
        fileCount: Object.keys(p.files || {}).length,
        rootFile: p.rootFile,
        activePath: p.activePath,
        paths: Object.keys(p.files || {}).sort()
      };
    };

    storage.__fullCommitPatched = true;
    console.log("[Latexai Step3B] Patched LAI_STORAGE for full-project commits.");
    return true;
  }

  function settings() {
    return Object.assign({
      backendBase: "https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github",
      owner: "",
      repo: "",
      branch: "main",
      rootPath: "",
      lastCommitSha: null
    }, safeJson(localStorage.getItem(SETTINGS_KEY), {}));
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  async function apiFetch(path, body) {
    var s = settings();
    var res = await fetch(s.backendBase.replace(/\/$/, "") + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    var text = await res.text();
    var data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data.message || data));
    return data;
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "style") Object.assign(el.style, attrs[k]);
      else if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { el.appendChild(c); });
    return el;
  }

  function initPanel() {
    if (document.getElementById("lai-github-full-commit-panel")) return;
    patchStorage();

    var s = settings();
    var panel = h("div", { id: "lai-github-full-commit-panel", style: {
      position: "fixed", left: "12px", top: "12px", zIndex: "1000000",
      width: "335px", maxHeight: "78vh", overflow: "auto", background: "rgba(255,255,255,0.98)", color: "#111",
      border: "1px solid #888", borderRadius: "10px", boxShadow: "0 4px 18px rgba(0,0,0,0.22)",
      font: "13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: "10px"
    }});

    function input(label, value) {
      var inp = h("input", { type: "text", value: value || "", style: {
        width: "100%", boxSizing: "border-box", margin: "2px 0 6px 0", padding: "5px",
        border: "1px solid #aaa", borderRadius: "6px"
      }});
      var wrap = h("label", { style: { display: "block", fontSize: "12px", fontWeight: "600" } }, [document.createTextNode(label), inp]);
      return { wrap: wrap, input: inp };
    }

    function btn(label) {
      return h("button", { type: "button", style: {
        margin: "2px", padding: "5px 7px", borderRadius: "7px", border: "1px solid #999", background: "#f7f7f7", color: "#111",
        font: "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }, text: label });
    }

    var title = h("div", { text: "GitHub Full Commit", style: { fontWeight: "700", marginBottom: "6px" } });
    var backend = input("Backend URL", s.backendBase);
    var owner = input("Owner / org", s.owner);
    var repo = input("Repo", s.repo);
    var branch = input("Branch", s.branch || "main");
    var rootPath = input("Folder path in repo", s.rootPath || "");
    var status = h("div", { style: { whiteSpace: "pre-wrap", lineHeight: "1.35", margin: "6px 0" }, text: "Use Preview before committing." });

    function pull() {
      var next = settings();
      next.backendBase = backend.input.value.trim();
      next.owner = owner.input.value.trim();
      next.repo = repo.input.value.trim();
      next.branch = branch.input.value.trim() || "main";
      next.rootPath = rootPath.input.value.trim().replace(/^\/+|\/+$/g, "");
      saveSettings(next);
      return next;
    }

    [backend.input, owner.input, repo.input, branch.input, rootPath.input].forEach(function (x) {
      x.addEventListener("change", pull);
      x.addEventListener("blur", pull);
    });

    var checkBtn = btn("Check backend");
    var loadBtn = btn("Load");
    var previewBtn = btn("Preview commit files");
    var commitBtn = btn("Commit All Files");
    var hideBtn = btn("Hide");

    checkBtn.onclick = async function () {
      try {
        pull();
        status.textContent = "Checking...";
        var r = await apiFetch("/status");
        status.textContent = "Backend: " + (r.ok ? "online" : "not ok") + "\nToken: " + (r.githubTokenConfigured ? "configured" : "missing") + "\nStage: " + (r.stage || "");
      } catch (e) { status.textContent = "Check failed:\n" + (e.message || e); }
    };

    loadBtn.onclick = async function () {
      try {
        var x = pull();
        status.textContent = "Loading from GitHub...";
        var r = await apiFetch("/load-project", { owner: x.owner, repo: x.repo, branch: x.branch, rootPath: x.rootPath });
        if (!root.LAI_STORAGE || typeof root.LAI_STORAGE.applyProject !== "function") throw new Error("LAI_STORAGE.applyProject missing");
        root.LAI_STORAGE.applyProject(r.project);
        if (typeof root.LAI_STORAGE.saveNow === "function") await root.LAI_STORAGE.saveNow();
        x.lastCommitSha = r.headSha || null;
        saveSettings(x);
        var paths = Object.keys(r.project.files || {}).sort();
        status.textContent = "Loaded " + paths.length + " files.\nHEAD: " + (r.headSha || "") + "\n\n" + paths.slice(0, 60).join("\n") + (paths.length > 60 ? "\n..." : "");
      } catch (e) { status.textContent = "Load failed:\n" + (e.message || e); }
    };

    previewBtn.onclick = function () {
      try {
        patchStorage();
        var p = root.LAI_STORAGE.discoverProject();
        var paths = Object.keys(p.files || {}).sort();
        status.textContent = "Files that will be committed: " + paths.length + "\nRoot: " + p.rootFile + "\n\n" + paths.slice(0, 100).join("\n") + (paths.length > 100 ? "\n..." : "");
      } catch (e) { status.textContent = "Preview failed:\n" + (e.message || e); }
    };

    commitBtn.onclick = async function () {
      try {
        var x = pull();
        patchStorage();
        var p = root.LAI_STORAGE.discoverProject();
        var paths = Object.keys(p.files || {}).sort();
        if (!paths.length) throw new Error("No files discovered.");
        status.textContent = "Committing " + paths.length + " files...";
        var r = await apiFetch("/autosave-commit", {
          owner: x.owner, repo: x.repo, branch: x.branch, rootPath: x.rootPath,
          expectedHeadSha: x.lastCommitSha || null,
          message: "Latexai full-project save: " + new Date().toISOString(),
          project: p,
          files: p.files
        });
        x.lastCommitSha = r.commitSha || null;
        saveSettings(x);
        status.textContent = "Committed " + (r.fileCount || paths.length) + " files.\nCommit: " + (r.commitSha || "") + "\n\n" + ((r.pathsCommitted || paths).slice(0, 100).join("\n"));
      } catch (e) { status.textContent = "Commit failed:\n" + (e.message || e); }
    };

    hideBtn.onclick = function () {
      panel.style.display = "none";
      var reopen = btn("Full Commit");
      Object.assign(reopen.style, { position: "fixed", left: "12px", top: "12px", zIndex: "1000000", borderRadius: "999px", background: "#fff" });
      reopen.onclick = function () { panel.style.display = ""; reopen.remove(); };
      document.body.appendChild(reopen);
    };

    panel.appendChild(title);
    panel.appendChild(backend.wrap);
    panel.appendChild(owner.wrap);
    panel.appendChild(repo.wrap);
    panel.appendChild(branch.wrap);
    panel.appendChild(rootPath.wrap);
    panel.appendChild(h("div", {}, [checkBtn, loadBtn, previewBtn, commitBtn, hideBtn]));
    panel.appendChild(status);
    document.body.appendChild(panel);
  }

  function waitPatch() {
    if (patchStorage()) return;
    setTimeout(waitPatch, 500);
  }

  root.LAI_FULL_PROJECT_COMMIT = { STAGE: STAGE, patchStorage: patchStorage, harvestFullProject: harvestFullProject };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { waitPatch(); initPanel(); }, { once: true });
  else { waitPatch(); initPanel(); }

  console.log("[Latexai Step3B]", STAGE);
})();
