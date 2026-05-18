/* Latexai Step 3E Direct GitHub Project Loader
 * Stage: latex-stage3e-direct-github-project-loader-20260518-1
 *
 * Purpose:
 *   Fix cases where the GitHub backend says multiple files loaded, but the UI
 *   collapses back to one file. This loader does not rely on the original
 *   Latexai file-tree state. It calls /load-project directly, keeps the exact
 *   project returned by the backend, and renders its own stable file list.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3e-direct-github-project-loader-20260518-1";
  var SETTINGS_KEY = "latexai.step3e.directGithub.settings.v1";
  var PROJECT_KEY = "latexai.step3e.directGithub.project.v1";
  var root = typeof window !== "undefined" ? window : globalThis;

  var state = {
    backendBase: "https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github",
    owner: "",
    repo: "",
    branch: "main",
    rootPath: "",
    headSha: null,
    project: null,
    files: {},
    rootFile: "main.tex",
    activePath: "main.tex",
    lastMessage: ""
  };

  function norm(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function loadSettings() {
    var saved = safeJson(localStorage.getItem(SETTINGS_KEY), {});
    Object.assign(state, saved || {});
    var savedProject = safeJson(localStorage.getItem(PROJECT_KEY), null);
    if (savedProject && savedProject.files) {
      setProject(savedProject, state.headSha, false);
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      backendBase: state.backendBase,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      rootPath: state.rootPath,
      headSha: state.headSha
    }));
  }

  function editor() {
    return document.getElementById("sourceEditor") || document.querySelector("textarea");
  }

  function setEditorText(text) {
    var ed = editor();
    if (!ed) return false;
    ed.value = String(text || "");
    ed.dispatchEvent(new Event("input", { bubbles: true }));
    ed.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setActivePill(path) {
    path = norm(path);
    var pill = document.getElementById("activeFilePill");
    if (pill) pill.textContent = path;
    var cursor = document.getElementById("cursorStatus");
    if (cursor) cursor.textContent = "Ln 1, Col 1";
  }

  function saveEditorToActive() {
    var ed = editor();
    if (!ed || !state.activePath) return;
    state.files[state.activePath] = String(ed.value || "");
    persistProject();
  }

  function inferRoot(files, preferred) {
    preferred = norm(preferred || "");
    if (preferred && files[preferred]) return preferred;
    if (files["main.tex"]) return "main.tex";
    var tex = Object.keys(files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
    return tex[0] || preferred || "main.tex";
  }

  function projectObject() {
    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: (state.owner && state.repo) ? (state.owner + "/" + state.repo) : "GitHub project",
      rootFile: state.rootFile,
      activePath: state.activePath,
      files: Object.assign({}, state.files),
      github: {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        headSha: state.headSha
      },
      updatedAt: new Date().toISOString()
    };
  }

  function persistProject() {
    var p = projectObject();
    state.project = p;
    try {
      localStorage.setItem(PROJECT_KEY, JSON.stringify(p));

      root.currentProject = Object.assign({}, root.currentProject || {}, p);
      root.project = root.currentProject;
      root.LuminaLatex = root.LuminaLatex || {};
      root.NS = root.NS || root.LuminaLatex;
      root.LuminaLatex.project = root.currentProject;
      root.LuminaLatex.storageProject = p;
      root.NS.project = root.currentProject;
      root.NS.storageProject = p;

      if (root.LAI_STORAGE && !root.LAI_STORAGE.__directGithubPatched) {
        var oldDiscover = typeof root.LAI_STORAGE.discoverProject === "function"
          ? root.LAI_STORAGE.discoverProject.bind(root.LAI_STORAGE)
          : null;

        root.LAI_STORAGE.discoverProject = function () {
          saveEditorToActive();
          var base = oldDiscover ? (oldDiscover() || {}) : {};
          var merged = Object.assign({}, state.files);
          if (base.files && typeof base.files === "object") {
            Object.keys(base.files).forEach(function (k) {
              if (!(k in merged)) merged[k] = base.files[k];
            });
          }
          return Object.assign({}, base, {
            schema: "lumina-latex-project-v1",
            storageStage: STAGE,
            rootFile: state.rootFile,
            activePath: state.activePath,
            files: merged
          });
        };
        root.LAI_STORAGE.__directGithubPatched = true;
      }
    } catch (_) {}
  }

  function setProject(project, headSha, openRoot) {
    if (!project || !project.files) return false;
    state.project = project;
    state.files = Object.assign({}, project.files || {});
    state.rootFile = inferRoot(state.files, project.rootFile || project.activePath);
    state.activePath = norm(project.activePath || state.rootFile);
    if (!state.files[state.activePath]) state.activePath = state.rootFile;
    state.headSha = headSha || (project.github && project.github.headSha) || state.headSha || null;

    persistProject();

    if (openRoot !== false) {
      openFile(state.activePath || state.rootFile);
    }

    return true;
  }

  function openFile(path) {
    saveEditorToActive();
    path = norm(path);
    if (!(path in state.files)) {
      state.lastMessage = "File not found in loaded project: " + path;
      render();
      return;
    }
    state.activePath = path;
    setActivePill(path);
    setEditorText(state.files[path]);
    persistProject();
    render();
  }

  function addFile() {
    saveEditorToActive();
    var path = prompt("New file path, e.g. sections/intro.tex or refs.bib");
    path = norm(path || "");
    if (!path) return;
    if (!/\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i.test(path)) {
      alert("For now, add text-like project files only: .tex, .bib, .sty, .cls, .txt, .md");
      return;
    }
    if (!(path in state.files)) state.files[path] = "";
    state.lastMessage = "Added " + path;
    openFile(path);
  }

  async function apiFetch(path, body) {
    var url = state.backendBase.replace(/\/$/, "") + path;
    var res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    var text = await res.text();
    var data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
    if (!res.ok) {
      var msg = data.detail || data.message || data.raw || ("HTTP " + res.status);
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function pullForm() {
    var b = document.getElementById("lai3eBackend");
    var o = document.getElementById("lai3eOwner");
    var r = document.getElementById("lai3eRepo");
    var br = document.getElementById("lai3eBranch");
    var rp = document.getElementById("lai3eRootPath");

    if (b) state.backendBase = b.value.trim();
    if (o) state.owner = o.value.trim();
    if (r) state.repo = r.value.trim();
    if (br) state.branch = br.value.trim() || "main";
    if (rp) state.rootPath = rp.value.trim().replace(/^\/+|\/+$/g, "");

    saveSettings();
  }

  async function checkBackend() {
    try {
      pullForm();
      state.lastMessage = "Checking backend...";
      render();
      var r = await apiFetch("/status");
      state.lastMessage = "Backend: " + (r.ok ? "online" : "not ok") +
        "\nToken: " + (r.githubTokenConfigured ? "configured" : "missing") +
        "\nStage: " + (r.stage || "");
      render();
    } catch (e) {
      state.lastMessage = "Backend check failed:\n" + (e.message || e);
      render();
    }
  }

  async function loadExactProject() {
    try {
      pullForm();
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");
      state.lastMessage = "Loading exact project from backend...";
      render();

      var r = await apiFetch("/load-project", {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath
      });

      if (!r.project || !r.project.files) throw new Error("Backend returned no project.files.");

      setProject(r.project, r.headSha, true);
      var paths = Object.keys(state.files).sort();

      state.lastMessage =
        "Backend returned " + (r.fileCount || paths.length) + " files.\n" +
        "Direct loader stored " + paths.length + " files.\n" +
        "HEAD: " + (r.headSha || "unknown");

      render();
    } catch (e) {
      state.lastMessage = "Load failed:\n" + (e.message || e);
      render();
    }
  }

  function previewFiles() {
    saveEditorToActive();
    var paths = Object.keys(state.files || {}).sort();
    state.lastMessage = "Files currently loaded: " + paths.length + "\n\n" + paths.join("\n");
    render();
  }

  async function commitAll() {
    try {
      pullForm();
      saveEditorToActive();
      var paths = Object.keys(state.files || {}).sort();
      if (!paths.length) throw new Error("No loaded files to commit.");
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");

      state.lastMessage = "Committing " + paths.length + " files...";
      render();

      var r = await apiFetch("/autosave-commit", {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        expectedHeadSha: state.headSha || null,
        message: "Latexai direct full-project save: " + new Date().toISOString(),
        project: projectObject(),
        files: state.files
      });

      state.headSha = r.commitSha || state.headSha;
      saveSettings();

      state.lastMessage =
        "Committed " + (r.fileCount || paths.length) + " files.\n" +
        "Commit: " + (r.commitSha || "unknown") + "\n\n" +
        ((r.pathsCommitted || paths).slice(0, 80).join("\n"));

      render();
    } catch (e) {
      state.lastMessage = "Commit failed:\n" + (e.message || e);
      render();
    }
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

  function input(id, label, value, placeholder) {
    var inp = h("input", {
      id: id,
      type: "text",
      value: value || "",
      placeholder: placeholder || "",
      style: {
        width: "100%",
        boxSizing: "border-box",
        margin: "2px 0 6px 0",
        padding: "5px",
        border: "1px solid #aaa",
        borderRadius: "6px"
      }
    });
    return h("label", {
      style: { display: "block", fontSize: "12px", fontWeight: "600" }
    }, [document.createTextNode(label), inp]);
  }

  function btn(label, fn) {
    var b = h("button", {
      type: "button",
      text: label,
      style: {
        margin: "2px",
        padding: "5px 7px",
        borderRadius: "7px",
        border: "1px solid #999",
        background: "#f7f7f7",
        color: "#111",
        font: "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }
    });
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      fn();
    }, true);
    return b;
  }

  function renderFileList(container) {
    container.innerHTML = "";

    var paths = Object.keys(state.files || {}).sort();
    var title = h("div", {
      text: "Direct loaded files (" + paths.length + ")",
      style: { fontWeight: "700", margin: "6px 0" }
    });
    container.appendChild(title);

    var tools = h("div", { style: { marginBottom: "6px" } }, [
      btn("+ file", addFile),
      btn("Preview files", previewFiles)
    ]);
    container.appendChild(tools);

    var list = h("div", {
      style: {
        maxHeight: "260px",
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "4px"
      }
    });

    paths.forEach(function (path) {
      var row = h("button", {
        type: "button",
        text: path,
        title: path,
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          margin: "1px 0",
          padding: "5px 7px",
          border: "0",
          borderRadius: "7px",
          background: path === state.activePath ? "#e9eefc" : "transparent",
          color: "#111",
          font: "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        }
      });
      row.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        openFile(path);
      }, true);
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  function render() {
    var panel = document.getElementById("lai-direct-github-loader");
    if (!panel) return;

    var status = document.getElementById("lai3eStatus");
    if (status) status.textContent = state.lastMessage || "Ready.";

    var list = document.getElementById("lai3eFileList");
    if (list) renderFileList(list);
  }

  function initPanel() {
    if (document.getElementById("lai-direct-github-loader")) {
      render();
      return;
    }

    var panel = h("div", {
      id: "lai-direct-github-loader",
      style: {
        position: "fixed",
        left: "12px",
        top: "12px",
        zIndex: "1000002",
        width: "360px",
        maxHeight: "86vh",
        overflow: "auto",
        background: "rgba(255,255,255,0.99)",
        color: "#111",
        border: "2px solid #555",
        borderRadius: "10px",
        boxShadow: "0 4px 22px rgba(0,0,0,0.28)",
        font: "13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "10px"
      }
    });

    panel.appendChild(h("div", {
      text: "Direct GitHub Project Loader",
      style: { fontWeight: "800", marginBottom: "6px" }
    }));

    panel.appendChild(input("lai3eBackend", "Backend URL", state.backendBase, "https://.../api/lumina/github"));
    panel.appendChild(input("lai3eOwner", "Owner / org", state.owner, "github-user"));
    panel.appendChild(input("lai3eRepo", "Repo", state.repo, "repo-name"));
    panel.appendChild(input("lai3eBranch", "Branch", state.branch || "main", "main"));
    panel.appendChild(input("lai3eRootPath", "Folder path", state.rootPath || "", "blank or folder"));

    panel.appendChild(h("div", {}, [
      btn("Check", checkBackend),
      btn("Load Exact Project", loadExactProject),
      btn("Commit All", commitAll),
      btn("Hide", function () {
        panel.style.display = "none";
        var reopen = btn("Direct GitHub", function () {
          panel.style.display = "";
          reopen.remove();
          render();
        });
        Object.assign(reopen.style, {
          position: "fixed",
          left: "12px",
          top: "12px",
          zIndex: "1000002",
          borderRadius: "999px",
          background: "#fff"
        });
        document.body.appendChild(reopen);
      })
    ]));

    panel.appendChild(h("pre", {
      id: "lai3eStatus",
      style: {
        whiteSpace: "pre-wrap",
        lineHeight: "1.3",
        background: "#f7f7f7",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "6px",
        maxHeight: "140px",
        overflow: "auto"
      },
      text: state.lastMessage || "Ready."
    }));

    panel.appendChild(h("div", { id: "lai3eFileList" }));

    document.body.appendChild(panel);
    render();
  }

  function hideOlderGithubPanels() {
    [
      "lai-github-sync-panel",
      "lai-github-full-commit-panel",
      "lai-stable-github-file-list",
      "lai-file-tree-sync"
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  function init() {
    loadSettings();
    hideOlderGithubPanels();
    initPanel();
    if (state.project && state.files && Object.keys(state.files).length) {
      persistProject();
      render();
    }

    var ed = editor();
    if (ed) {
      ed.addEventListener("input", function () {
        if (state.activePath) {
          state.files[state.activePath] = String(ed.value || "");
          persistProject();
        }
      });
    }
  }

  root.LAI_DIRECT_GITHUB = {
    STAGE: STAGE,
    loadExactProject: loadExactProject,
    commitAll: commitAll,
    previewFiles: previewFiles,
    openFile: openFile,
    getState: function () {
      return {
        stage: STAGE,
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        rootFile: state.rootFile,
        activePath: state.activePath,
        fileCount: Object.keys(state.files || {}).length,
        paths: Object.keys(state.files || {}).sort(),
        headSha: state.headSha
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  try { console.log("[Latexai Direct GitHub]", STAGE); } catch (_) {}
})();
