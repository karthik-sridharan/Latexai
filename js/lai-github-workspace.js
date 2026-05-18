/* Latexai Step 3F Stable GitHub Workspace
 * Stage: latex-stage3f-stable-github-workspace-20260518-1
 *
 * Fixes:
 * - Loaded files collapse back to one file.
 * - Selecting a GitHub-loaded file appears to refresh/move away.
 * - The injected list did not look like the original file tree.
 *
 * This script hides the original #fileTree and replaces it with a stable
 * GitHub-backed file tree inside the left Files panel. It keeps its own exact
 * loaded project state and does not dispatch normal input/change events when
 * switching files, so the original app renderer does not hijack the click.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3f-stable-github-workspace-20260518-1";
  var SETTINGS_KEY = "latexai.step3f.github.settings.v1";
  var PROJECT_KEY = "latexai.step3f.github.project.v1";
  var root = typeof window !== "undefined" ? window : globalThis;

  var state = {
    backendBase: "https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github",
    owner: "",
    repo: "",
    branch: "main",
    rootPath: "",
    headSha: null,
    files: {},
    rootFile: "main.tex",
    activePath: "main.tex",
    message: "Load a project from GitHub.",
    dirty: false,
    panelOpen: false
  };

  function norm(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function validTextPath(path) {
    path = norm(path);
    return path &&
      !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i.test(path);
  }

  function validProjectPath(path) {
    path = norm(path);
    return path &&
      !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx|png|jpg|jpeg|pdf|svg|eps)$/i.test(path);
  }

  function isTextFile(path, content) {
    return validTextPath(path) && !(String(content || "").slice(0, 20).indexOf("data:") === 0);
  }

  function loadSaved() {
    var s = safeJson(localStorage.getItem(SETTINGS_KEY), {});
    Object.assign(state, s || {});
    var p = safeJson(localStorage.getItem(PROJECT_KEY), null);
    if (p && p.files) {
      state.files = Object.assign({}, p.files);
      state.rootFile = p.rootFile || inferRoot(state.files, state.rootFile);
      state.activePath = p.activePath || state.rootFile;
      state.headSha = (p.github && p.github.headSha) || state.headSha;
      state.message = "Restored local GitHub workspace with " + Object.keys(state.files).length + " files.";
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

  function inferRoot(files, preferred) {
    preferred = norm(preferred || "");
    if (preferred && files[preferred]) return preferred;
    if (files["main.tex"]) return "main.tex";
    var tex = Object.keys(files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
    return tex[0] || preferred || "main.tex";
  }

  function editor() {
    return document.getElementById("sourceEditor") || document.querySelector("textarea");
  }

  function updateLineGutter(text) {
    var gutter = document.getElementById("lineGutter");
    if (!gutter) return;
    var n = Math.max(1, String(text || "").split("\n").length);
    var lines = [];
    for (var i = 1; i <= n; i++) lines.push(String(i));
    gutter.textContent = lines.join("\n");
  }

  function setEditorText(text) {
    var ed = editor();
    if (!ed) return false;
    ed.value = String(text || "");
    updateLineGutter(text);
    var cursor = document.getElementById("cursorStatus");
    if (cursor) cursor.textContent = "Ln 1, Col 1";
    return true;
  }

  function setActivePill(path) {
    var pill = document.getElementById("activeFilePill");
    if (pill) pill.textContent = path;
  }

  function saveActiveEditor() {
    var ed = editor();
    if (!ed || !state.activePath) return;
    if (isTextFile(state.activePath, state.files[state.activePath])) {
      state.files[state.activePath] = String(ed.value || "");
      state.dirty = true;
      persistProject();
    }
  }

  function projectObject() {
    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: state.owner && state.repo ? state.owner + "/" + state.repo : "GitHub project",
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

      if (root.LAI_STORAGE && !root.LAI_STORAGE.__step3fPatched) {
        var oldDiscover = typeof root.LAI_STORAGE.discoverProject === "function"
          ? root.LAI_STORAGE.discoverProject.bind(root.LAI_STORAGE)
          : null;

        root.LAI_STORAGE.discoverProject = function () {
          saveActiveEditor();
          var base = {};
          try { base = oldDiscover ? (oldDiscover() || {}) : {}; } catch (_) {}
          return Object.assign({}, base, projectObject(), {
            files: Object.assign({}, state.files),
            rootFile: state.rootFile,
            activePath: state.activePath
          });
        };

        root.LAI_STORAGE.__step3fPatched = true;
      }
    } catch (_) {}
  }

  async function apiFetch(path, body) {
    var res = await fetch(state.backendBase.replace(/\/$/, "") + path, {
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
    var map = {
      backendBase: "lai3fBackend",
      owner: "lai3fOwner",
      repo: "lai3fRepo",
      branch: "lai3fBranch",
      rootPath: "lai3fRootPath"
    };
    Object.keys(map).forEach(function (k) {
      var el = document.getElementById(map[k]);
      if (el) state[k] = String(el.value || "").trim();
    });
    state.branch = state.branch || "main";
    state.rootPath = norm(state.rootPath);
    saveSettings();
  }

  async function checkBackend() {
    try {
      pullForm();
      state.message = "Checking backend...";
      render();
      var r = await apiFetch("/status");
      state.message = "Backend: " + (r.ok ? "online" : "not ok") +
        "\nToken: " + (r.githubTokenConfigured ? "configured" : "missing") +
        "\nStage: " + (r.stage || "");
      render();
    } catch (e) {
      state.message = "Backend check failed:\n" + (e.message || e);
      render();
    }
  }

  async function loadProject() {
    try {
      pullForm();
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");
      state.message = "Loading from GitHub...";
      render();

      var r = await apiFetch("/load-project", {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath
      });

      if (!r.project || !r.project.files) throw new Error("Backend returned no project.files.");

      state.files = Object.assign({}, r.project.files);
      state.rootFile = inferRoot(state.files, r.project.rootFile);
      state.activePath = state.files[r.project.activePath] ? r.project.activePath : state.rootFile;
      state.headSha = r.headSha || null;
      state.dirty = false;
      state.message = "Loaded " + Object.keys(state.files).length + " files from GitHub.";
      saveSettings();
      persistProject();
      openFile(state.activePath, true);
      render();
    } catch (e) {
      state.message = "Load failed:\n" + (e.message || e);
      render();
    }
  }

  async function commitAll() {
    try {
      pullForm();
      saveActiveEditor();

      var paths = Object.keys(state.files).filter(validProjectPath).sort();
      if (!paths.length) throw new Error("No files loaded.");
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");

      var files = {};
      paths.forEach(function (p) { files[p] = state.files[p]; });

      state.message = "Committing " + paths.length + " files...";
      render();

      var r = await apiFetch("/autosave-commit", {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        expectedHeadSha: state.headSha || null,
        message: "Latexai workspace save: " + new Date().toISOString(),
        project: projectObject(),
        files: files
      });

      state.headSha = r.commitSha || state.headSha;
      state.dirty = false;
      saveSettings();
      persistProject();

      state.message = "Committed " + (r.fileCount || paths.length) + " files.\nCommit: " + (r.commitSha || "unknown");
      render();
    } catch (e) {
      state.message = "Commit failed:\n" + (e.message || e);
      render();
    }
  }

  function openFile(path, skipSave) {
    path = norm(path);
    if (!(path in state.files)) {
      state.message = "File not loaded: " + path;
      render();
      return;
    }

    if (!skipSave) saveActiveEditor();

    state.activePath = path;
    setActivePill(path);

    if (isTextFile(path, state.files[path])) {
      setEditorText(state.files[path]);
      state.message = "Opened " + path;
    } else {
      setEditorText("% Binary/asset file selected: " + path + "\n% It will still be included in GitHub commits.");
      state.message = "Selected asset " + path;
    }

    persistProject();
    render();
  }

  function addFile() {
    saveActiveEditor();
    var path = prompt("New file path, e.g. sections/intro.tex or refs.bib");
    path = norm(path || "");
    if (!path) return;
    if (!validTextPath(path)) {
      alert("Use a text-like file path: .tex, .bib, .sty, .cls, .txt, .md");
      return;
    }
    if (!(path in state.files)) state.files[path] = "";
    state.dirty = true;
    openFile(path, true);
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

  function smallButton(label, fn) {
    var b = h("button", {
      type: "button",
      text: label,
      style: {
        margin: "2px",
        padding: "4px 7px",
        borderRadius: "8px",
        border: "1px solid rgba(0,0,0,0.18)",
        background: "#fff",
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

  function textInput(id, label, value, placeholder) {
    var input = h("input", {
      id: id,
      type: "text",
      value: value || "",
      placeholder: placeholder || "",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "5px",
        margin: "2px 0 6px",
        border: "1px solid rgba(0,0,0,0.22)",
        borderRadius: "7px"
      }
    });
    return h("label", {
      style: { display: "block", fontSize: "12px", fontWeight: "600" }
    }, [document.createTextNode(label), input]);
  }

  function folderOf(path) {
    var parts = norm(path).split("/");
    parts.pop();
    return parts.join("/");
  }

  function renderFileRows(container) {
    container.innerHTML = "";
    var paths = Object.keys(state.files).filter(validProjectPath).sort();

    var lastFolder = null;
    paths.forEach(function (path) {
      var folder = folderOf(path);
      if (folder && folder !== lastFolder) {
        var f = h("div", {
          text: "▾ " + folder,
          style: {
            marginTop: "6px",
            padding: "3px 6px",
            font: "11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: "700",
            color: "#526070",
            textTransform: "none"
          }
        });
        container.appendChild(f);
        lastFolder = folder;
      }

      var name = path.split("/").pop();
      var row = h("button", {
        type: "button",
        title: path,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "7px",
          width: "100%",
          textAlign: "left",
          margin: "2px 0",
          padding: "7px 8px",
          border: "0",
          borderRadius: "12px",
          background: path === state.activePath ? "#dfe8ff" : "rgba(255,255,255,0.55)",
          color: "#111",
          font: "13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        }
      }, [
        h("span", {
          text: /\.(png|jpg|jpeg|pdf|svg|eps)$/i.test(path) ? "A" : "T",
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "20px",
            height: "20px",
            borderRadius: "7px",
            background: "rgba(0,0,0,0.08)",
            font: "11px system-ui",
            fontWeight: "700"
          }
        }),
        h("span", {
          text: folder ? name : path,
          style: {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }
        })
      ]);

      row.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        openFile(path);
      }, true);

      container.appendChild(row);
    });

    if (!paths.length) {
      container.appendChild(h("div", {
        text: "No files loaded yet.",
        style: { opacity: "0.7", padding: "8px" }
      }));
    }
  }

  function ensureWorkspacePanel() {
    var originalTree = document.getElementById("fileTree");
    if (originalTree) {
      originalTree.style.display = "none";
    }

    var existing = document.getElementById("lai3fWorkspace");
    if (existing) return existing;

    var filesSection = originalTree ? originalTree.parentNode : document.querySelector(".left-panel .panel-section");
    if (!filesSection) return null;

    var panel = h("div", {
      id: "lai3fWorkspace",
      style: {
        marginTop: "4px",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: "14px",
        padding: "8px",
        background: "rgba(255,255,255,0.55)"
      }
    });

    filesSection.insertBefore(panel, originalTree ? originalTree.nextSibling : null);
    return panel;
  }

  function render() {
    var panel = ensureWorkspacePanel();
    if (!panel) return;

    panel.innerHTML = "";

    var paths = Object.keys(state.files).filter(validProjectPath).sort();

    var header = h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        marginBottom: "6px"
      }
    }, [
      h("div", {}, [
        h("div", {
          text: "GitHub workspace",
          style: { fontWeight: "800", lineHeight: "1.1" }
        }),
        h("div", {
          text: paths.length + " files" + (state.dirty ? " • unsaved" : ""),
          style: { fontSize: "11px", opacity: "0.72", marginTop: "2px" }
        })
      ]),
      smallButton(state.panelOpen ? "Hide setup" : "Setup", function () {
        state.panelOpen = !state.panelOpen;
        render();
      })
    ]);
    panel.appendChild(header);

    if (state.panelOpen) {
      panel.appendChild(textInput("lai3fBackend", "Backend URL", state.backendBase, "https://.../api/lumina/github"));
      panel.appendChild(textInput("lai3fOwner", "Owner / org", state.owner, "github-user"));
      panel.appendChild(textInput("lai3fRepo", "Repo", state.repo, "repo-name"));
      panel.appendChild(textInput("lai3fBranch", "Branch", state.branch || "main", "main"));
      panel.appendChild(textInput("lai3fRootPath", "Folder path", state.rootPath || "", "blank or folder"));
      ["lai3fBackend", "lai3fOwner", "lai3fRepo", "lai3fBranch", "lai3fRootPath"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener("change", function () { pullForm(); render(); });
          el.addEventListener("blur", function () { pullForm(); });
        }
      });
    }

    var actions = h("div", { style: { margin: "5px 0 7px" } }, [
      smallButton("Check", checkBackend),
      smallButton("Load", loadProject),
      smallButton("+ file", addFile),
      smallButton("Commit", commitAll)
    ]);
    panel.appendChild(actions);

    var message = h("div", {
      text: state.message || "",
      style: {
        whiteSpace: "pre-wrap",
        fontSize: "11px",
        lineHeight: "1.25",
        background: "rgba(255,255,255,0.65)",
        borderRadius: "9px",
        padding: "6px",
        marginBottom: "6px",
        maxHeight: "86px",
        overflow: "auto"
      }
    });
    panel.appendChild(message);

    var list = h("div", {
      id: "lai3fFileList",
      style: {
        maxHeight: "310px",
        overflow: "auto",
        WebkitOverflowScrolling: "touch"
      }
    });
    panel.appendChild(list);
    renderFileRows(list);
  }

  function hideOldPanels() {
    [
      "lai-direct-github-loader",
      "lai-github-sync-panel",
      "lai-github-full-commit-panel",
      "lai-stable-github-file-list",
      "lai-file-tree-sync"
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    // Also hide old reopen pills that clutter the iPad screen.
    ["lai-github-sync-reopen", "lai-storage-reopen"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  function init() {
    loadSaved();
    hideOldPanels();
    persistProject();
    render();

    var ed = editor();
    if (ed) {
      ed.addEventListener("input", function () {
        if (state.activePath && isTextFile(state.activePath, state.files[state.activePath])) {
          state.files[state.activePath] = String(ed.value || "");
          state.dirty = true;
          persistProject();
          // Do not re-render on every keystroke; that causes the "moving away" feeling.
        }
      });
    }

    // A few startup renders in case the app creates #fileTree after us.
    [300, 1000, 2500].forEach(function (ms) {
      setTimeout(function () {
        hideOldPanels();
        render();
      }, ms);
    });
  }

  root.LAI_GITHUB_WORKSPACE = {
    STAGE: STAGE,
    loadProject: loadProject,
    commitAll: commitAll,
    openFile: openFile,
    addFile: addFile,
    getState: function () {
      return {
        stage: STAGE,
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        rootFile: state.rootFile,
        activePath: state.activePath,
        dirty: state.dirty,
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

  try { console.log("[Latexai GitHub Workspace]", STAGE); } catch (_) {}
})();
