/* Latexai Step 3G Integrated GitHub File Tree
 * Stage: latex-stage3g-integrated-github-filetree-20260518-1
 *
 * This is the clean replacement for the temporary GitHub panels.
 *
 * It uses the native Latexai left Source tree (#fileTree) as the single source
 * tree UI instead of adding/hiding competing file lists.
 *
 * Features:
 * - Load full project from GitHub.
 * - Render all files/subdirectories inside #fileTree.
 * - Switch files without collapsing back to one file.
 * - Add tracked files through the existing + button.
 * - Import multiple files into the project state.
 * - Save local project state.
 * - Commit all loaded/added/edited files to GitHub.
 * - Patch LAI_STORAGE.discoverProject and global project objects so compile,
 *   commit, and future AI workflows see the full file set.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3g-integrated-github-filetree-20260518-1";
  var SETTINGS_KEY = "latexai.step3g.github.settings.v1";
  var PROJECT_KEY = "latexai.step3g.project.v1";
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
    dirty: false,
    setupOpen: false,
    message: "Load from GitHub, import files, or create a new file.",
    rendering: false,
    observerInstalled: false
  };

  var TEXT_EXT = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx)$/i;
  var PROJECT_EXT = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx|png|jpg|jpeg|pdf|svg|eps)$/i;

  function norm(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  function safeJson(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function validPath(path) {
    path = norm(path);
    return path &&
      !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      PROJECT_EXT.test(path);
  }

  function isTextPath(path, content) {
    return TEXT_EXT.test(norm(path)) && !(String(content || "").slice(0, 20).indexOf("data:") === 0);
  }

  function inferRoot(files, preferred) {
    preferred = norm(preferred || "");
    if (preferred && files[preferred]) return preferred;
    if (files["main.tex"]) return "main.tex";
    var tex = Object.keys(files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
    return tex[0] || preferred || "main.tex";
  }

  function loadSaved() {
    var s = safeJson(localStorage.getItem(SETTINGS_KEY), {});
    Object.assign(state, s || {});
    var p = safeJson(localStorage.getItem(PROJECT_KEY), null);
    if (p && p.files) {
      state.files = Object.assign({}, p.files);
      state.rootFile = inferRoot(state.files, p.rootFile || state.rootFile);
      state.activePath = state.files[p.activePath] ? p.activePath : state.rootFile;
      state.headSha = (p.github && p.github.headSha) || state.headSha;
      state.message = "Restored local project with " + Object.keys(state.files).length + " files.";
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      backendBase: state.backendBase,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      rootPath: state.rootPath,
      headSha: state.headSha,
      setupOpen: state.setupOpen
    }));
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

  function setActiveUi(path) {
    path = norm(path);
    var pill = document.getElementById("activeFilePill");
    if (pill) pill.textContent = path;
    var rootSelect = document.getElementById("rootFileSelect");
    if (rootSelect) {
      var texPaths = Object.keys(state.files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
      rootSelect.innerHTML = "";
      texPaths.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        if (p === state.rootFile) opt.selected = true;
        rootSelect.appendChild(opt);
      });
      rootSelect.onchange = function () {
        state.rootFile = rootSelect.value || state.rootFile;
        persistProject();
        renderTree();
      };
    }
  }

  function saveActiveEditor() {
    var ed = editor();
    if (!ed || !state.activePath) return;
    if (isTextPath(state.activePath, state.files[state.activePath])) {
      state.files[state.activePath] = String(ed.value || "");
      state.dirty = true;
      persistProject();
    }
  }

  function projectObject() {
    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: state.owner && state.repo ? state.owner + "/" + state.repo : "Latexai project",
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

      if (root.LAI_STORAGE && !root.LAI_STORAGE.__step3gPatched) {
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

        root.LAI_STORAGE.applyProject = function (project) {
          if (project && project.files) {
            state.files = Object.assign({}, project.files);
            state.rootFile = inferRoot(state.files, project.rootFile || state.rootFile);
            state.activePath = state.files[project.activePath] ? project.activePath : state.rootFile;
            state.dirty = false;
            persistProject();
            openFile(state.activePath, true);
            renderTree();
            return true;
          }
          return false;
        };

        root.LAI_STORAGE.__step3gPatched = true;
      }

      var autosave = document.getElementById("autosaveStatus");
      if (autosave) autosave.textContent = state.dirty ? "Unsaved GitHub changes" : "Saved locally";
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

  function pullSetupForm() {
    var ids = {
      backendBase: "lai3gBackend",
      owner: "lai3gOwner",
      repo: "lai3gRepo",
      branch: "lai3gBranch",
      rootPath: "lai3gRootPath"
    };
    Object.keys(ids).forEach(function (k) {
      var el = document.getElementById(ids[k]);
      if (el) state[k] = String(el.value || "").trim();
    });
    state.branch = state.branch || "main";
    state.rootPath = norm(state.rootPath);
    saveSettings();
  }

  async function checkBackend() {
    try {
      pullSetupForm();
      state.message = "Checking backend...";
      renderTree();
      var r = await apiFetch("/status");
      state.message = "Backend: " + (r.ok ? "online" : "not ok") +
        "\nToken: " + (r.githubTokenConfigured ? "configured" : "missing") +
        "\nStage: " + (r.stage || "");
      renderTree();
    } catch (e) {
      state.message = "Backend check failed:\n" + (e.message || e);
      renderTree();
    }
  }

  async function loadFromGithub() {
    try {
      pullSetupForm();
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");

      state.message = "Loading from GitHub...";
      renderTree();

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
      renderTree();
    } catch (e) {
      state.message = "Load failed:\n" + (e.message || e);
      renderTree();
    }
  }

  async function commitAll() {
    try {
      pullSetupForm();
      saveActiveEditor();

      var paths = Object.keys(state.files).filter(validPath).sort();
      if (!paths.length) throw new Error("No files to commit.");
      if (!state.owner || !state.repo) throw new Error("Owner and repo are required.");

      var files = {};
      paths.forEach(function (p) { files[p] = state.files[p]; });

      state.message = "Committing " + paths.length + " files...";
      renderTree();

      var r = await apiFetch("/autosave-commit", {
        owner: state.owner,
        repo: state.repo,
        branch: state.branch,
        rootPath: state.rootPath,
        expectedHeadSha: state.headSha || null,
        message: "Latexai integrated save: " + new Date().toISOString(),
        project: projectObject(),
        files: files
      });

      state.headSha = r.commitSha || state.headSha;
      state.dirty = false;
      saveSettings();
      persistProject();
      state.message = "Committed " + (r.fileCount || paths.length) + " files.\nCommit: " + (r.commitSha || "unknown");
      renderTree();
    } catch (e) {
      state.message = "Commit failed:\n" + (e.message || e);
      renderTree();
    }
  }

  function openFile(path, skipSave) {
    path = norm(path);
    if (!(path in state.files)) {
      state.message = "File not found: " + path;
      renderTree();
      return;
    }

    if (!skipSave) saveActiveEditor();

    state.activePath = path;
    setActiveUi(path);

    if (isTextPath(path, state.files[path])) {
      setEditorText(state.files[path]);
      state.message = "Opened " + path;
    } else {
      setEditorText("% Asset selected: " + path + "\n% It will be included in Git commits, but is not editable as text.");
      state.message = "Selected asset " + path;
    }

    persistProject();
    renderTree();
  }

  function addFile(path, content) {
    path = norm(path || "");
    if (!path) return;
    if (!validPath(path)) {
      alert("Unsupported or unsafe file path: " + path);
      return;
    }
    if (!(path in state.files)) {
      state.files[path] = typeof content === "string" ? content : "";
    }
    state.dirty = true;
    persistProject();
    openFile(path, true);
  }

  function promptAddFile() {
    saveActiveEditor();
    var path = prompt("New file path, e.g. sections/intro.tex or refs.bib");
    if (path) addFile(path, "");
  }

  async function importFilesFromInput(input) {
    var list = Array.prototype.slice.call(input.files || []);
    if (!list.length) return;

    saveActiveEditor();

    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var path = norm(f.webkitRelativePath || f.name);
      if (!validPath(path)) continue;

      if (TEXT_EXT.test(path)) {
        state.files[path] = await f.text();
      } else {
        var buf = await f.arrayBuffer();
        var bytes = new Uint8Array(buf);
        var binary = "";
        for (var j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
        state.files[path] = "data:" + (f.type || "application/octet-stream") + ";base64," + btoa(binary);
      }
    }

    state.rootFile = inferRoot(state.files, state.rootFile);
    if (!state.activePath || !state.files[state.activePath]) state.activePath = state.rootFile;
    state.dirty = true;
    persistProject();
    renderTree();
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

  function btn(label, fn, extraClass) {
    var b = h("button", {
      type: "button",
      text: label,
      class: extraClass || "btn mini",
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

  function input(id, label, value, placeholder) {
    var inp = h("input", {
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
    }, [document.createTextNode(label), inp]);
  }

  function folderOf(path) {
    var parts = norm(path).split("/");
    parts.pop();
    return parts.join("/");
  }

  function renderSetup(container) {
    if (!state.setupOpen) return;

    container.appendChild(input("lai3gBackend", "GitHub backend URL", state.backendBase, "https://.../api/lumina/github"));
    container.appendChild(input("lai3gOwner", "Owner / org", state.owner, "github-user"));
    container.appendChild(input("lai3gRepo", "Repo", state.repo, "repo-name"));
    container.appendChild(input("lai3gBranch", "Branch", state.branch || "main", "main"));
    container.appendChild(input("lai3gRootPath", "Folder path", state.rootPath || "", "blank or folder"));

    ["lai3gBackend", "lai3gOwner", "lai3gRepo", "lai3gBranch", "lai3gRootPath"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", function () { pullSetupForm(); });
        el.addEventListener("blur", function () { pullSetupForm(); });
      }
    });
  }

  function renderRows(container) {
    var paths = Object.keys(state.files).filter(validPath).sort();
    var lastFolder = null;

    paths.forEach(function (path) {
      var folder = folderOf(path);
      if (folder && folder !== lastFolder) {
        container.appendChild(h("div", {
          text: "▾ " + folder,
          style: {
            marginTop: "6px",
            padding: "3px 6px",
            font: "11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: "700",
            color: "#526070"
          }
        }));
        lastFolder = folder;
      }

      var isAsset = !isTextPath(path, state.files[path]);
      var label = folder ? path.split("/").pop() : path;

      var row = h("button", {
        type: "button",
        title: path,
        role: "treeitem",
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
          text: isAsset ? "A" : "T",
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
          text: label,
          style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
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

  function renderTree() {
    var tree = document.getElementById("fileTree");
    if (!tree) return;

    state.rendering = true;
    tree.innerHTML = "";
    tree.setAttribute("data-lai-integrated-tree", STAGE);

    var paths = Object.keys(state.files).filter(validPath).sort();

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
        h("div", { text: "Project files", style: { fontWeight: "800", lineHeight: "1.1" } }),
        h("div", {
          text: paths.length + " files" + (state.dirty ? " • unsaved" : ""),
          style: { fontSize: "11px", opacity: "0.72", marginTop: "2px" }
        })
      ]),
      btn(state.setupOpen ? "Hide setup" : "Git", function () {
        state.setupOpen = !state.setupOpen;
        saveSettings();
        renderTree();
      })
    ]);
    tree.appendChild(header);

    renderSetup(tree);

    var actions = h("div", { style: { margin: "5px 0 7px" } }, [
      btn("Check", checkBackend),
      btn("Load", loadFromGithub),
      btn("+ file", promptAddFile),
      btn("Commit", commitAll)
    ]);
    tree.appendChild(actions);

    var msg = h("div", {
      text: state.message || "",
      style: {
        whiteSpace: "pre-wrap",
        fontSize: "11px",
        lineHeight: "1.25",
        background: "rgba(255,255,255,0.65)",
        borderRadius: "9px",
        padding: "6px",
        marginBottom: "6px",
        maxHeight: "82px",
        overflow: "auto"
      }
    });
    tree.appendChild(msg);

    var list = h("div", {
      style: { maxHeight: "330px", overflow: "auto", WebkitOverflowScrolling: "touch" }
    });
    renderRows(list);
    tree.appendChild(list);

    setActiveUi(state.activePath);
    state.rendering = false;
  }

  function installObserver() {
    var tree = document.getElementById("fileTree");
    if (!tree || state.observerInstalled) return;

    var obs = new MutationObserver(function () {
      if (state.rendering) return;
      if (tree.getAttribute("data-lai-integrated-tree") === STAGE) return;
      setTimeout(function () {
        if (!state.rendering) renderTree();
      }, 80);
    });

    obs.observe(tree, { childList: true });
    state.observerInstalled = true;
  }

  function hookExistingControls() {
    var newFile = document.getElementById("newFileBtn");
    if (newFile && !newFile.__lai3gHooked) {
      newFile.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        promptAddFile();
      }, true);
      newFile.__lai3gHooked = true;
    }

    var saveBtn = document.getElementById("saveProjectBtn");
    if (saveBtn && !saveBtn.__lai3gHooked) {
      saveBtn.addEventListener("click", function () {
        saveActiveEditor();
        state.dirty = false;
        persistProject();
        state.message = "Saved locally.";
        renderTree();
      }, true);
      saveBtn.__lai3gHooked = true;
    }

    var importBtn = document.getElementById("importFilesBtn");
    var inputEl = document.getElementById("importFileInput");
    if (importBtn && inputEl && !importBtn.__lai3gHooked) {
      importBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        inputEl.click();
      }, true);
      inputEl.addEventListener("change", function () {
        importFilesFromInput(inputEl);
      });
      importBtn.__lai3gHooked = true;
    }
  }

  function init() {
    loadSaved();
    persistProject();
    hookExistingControls();
    installObserver();
    renderTree();

    var ed = editor();
    if (ed && !ed.__lai3gHooked) {
      ed.addEventListener("input", function () {
        if (state.activePath && isTextPath(state.activePath, state.files[state.activePath])) {
          state.files[state.activePath] = String(ed.value || "");
          state.dirty = true;
          persistProject();
          // No tree re-render on each keystroke.
        }
      });
      ed.__lai3gHooked = true;
    }

    [300, 1000, 2500].forEach(function (ms) {
      setTimeout(function () {
        hookExistingControls();
        installObserver();
        renderTree();
      }, ms);
    });
  }

  root.LAI_INTEGRATED_FILETREE = {
    STAGE: STAGE,
    loadFromGithub: loadFromGithub,
    commitAll: commitAll,
    addFile: addFile,
    openFile: openFile,
    renderTree: renderTree,
    getState: function () {
      saveActiveEditor();
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

  try { console.log("[Latexai Integrated FileTree]", STAGE); } catch (_) {}
})();
