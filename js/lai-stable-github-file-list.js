/* Latexai Step 3D stable GitHub file list
 * Stage: latex-stage3d-stable-github-file-list-20260518-1
 *
 * This fixes the Step 3C behavior where the original app's file-tree renderer
 * fought with our injected file tree and collapsed back to one file.
 *
 * Design:
 * - Do NOT replace #fileTree.
 * - Add a separate stable "GitHub loaded files" panel below the original tree.
 * - Stop click propagation so the original delegated file-tree handlers do not
 *   hijack our file buttons.
 * - Patch LAI_STORAGE.applyProject and discoverProject so full loaded projects
 *   are retained and committed/compiled as a full file set.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3d-stable-github-file-list-20260518-1";
  var root = typeof window !== "undefined" ? window : globalThis;

  var state = {
    files: {},
    rootFile: "main.tex",
    activePath: "main.tex",
    lastLoadedAt: null,
    lastSavedAt: null
  };

  var TEXT_ASSET_RE = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx|png|jpg|jpeg|pdf|svg|eps)$/i;

  function norm(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  function validPath(path) {
    path = norm(path);
    return path &&
      !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      TEXT_ASSET_RE.test(path);
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

  function mergeFiles(target, filesLike) {
    if (!filesLike) return target;

    if (Array.isArray(filesLike)) {
      filesLike.forEach(function (f) {
        if (!f || typeof f !== "object") return;
        var p = norm(f.path || f.name || f.filename || f.filePath || f.relativePath || "");
        var t = textFrom(f);
        if (validPath(p) && t !== null) target[p] = t;
      });
      return target;
    }

    if (typeof filesLike === "object") {
      Object.keys(filesLike).forEach(function (path) {
        var v = filesLike[path];
        var p = norm(path);
        var t = textFrom(v);
        if (v && typeof v === "object") p = norm(v.path || v.name || v.filename || p);
        if (validPath(p) && t !== null) target[p] = t;
      });
    }

    return target;
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

  function getDomActivePath() {
    var pill = document.getElementById("activeFilePill");
    return norm((pill && pill.textContent) || state.activePath || state.rootFile || "main.tex");
  }

  function setDomActivePath(path) {
    path = norm(path);
    state.activePath = path;
    var pill = document.getElementById("activeFilePill");
    if (pill) pill.textContent = path;
    var cursor = document.getElementById("cursorStatus");
    if (cursor) cursor.textContent = "Ln 1, Col 1";
  }

  function saveEditorIntoState() {
    var ed = editor();
    var path = getDomActivePath();
    if (ed && path && validPath(path)) {
      state.files[path] = String(ed.value || "");
      state.activePath = path;
      state.lastSavedAt = new Date().toISOString();
      persistProject();
    }
  }

  function setEditorText(text) {
    var ed = editor();
    if (!ed) return false;
    ed.value = String(text || "");
    ed.dispatchEvent(new Event("input", { bubbles: true }));
    ed.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function scanProjectLike(project) {
    if (!project || typeof project !== "object") return;
    mergeFiles(state.files, project.files || project.fileMap || project.sources || project.documents || project.projectFiles);
    if (project.rootFile) state.rootFile = inferRoot(state.files, project.rootFile);
    if (project.activePath && state.files[norm(project.activePath)]) state.activePath = norm(project.activePath);
  }

  function scanLocalStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!/(latex|latexai|lumina|project|file|store|github)/i.test(key || "")) continue;
        var obj = null;
        try { obj = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
        if (!obj || typeof obj !== "object") continue;
        scanProjectLike(obj);
        if (obj.project) scanProjectLike(obj.project);
      }
    } catch (_) {}
  }

  function collect() {
    scanProjectLike(root.currentProject);
    scanProjectLike(root.project);
    scanProjectLike(root.LatexaiProject);
    scanProjectLike(root.LuminaLatex && root.LuminaLatex.storageProject);
    scanProjectLike(root.LuminaLatex && root.LuminaLatex.project);
    scanProjectLike(root.NS && root.NS.storageProject);
    scanProjectLike(root.NS && root.NS.project);
    scanLocalStorage();

    var ed = editor();
    var active = getDomActivePath();
    if (ed && active && validPath(active)) state.files[active] = String(ed.value || "");

    state.rootFile = inferRoot(state.files, state.rootFile);
    if (!state.activePath || !state.files[state.activePath]) state.activePath = state.rootFile;

    persistProject();
    return state.files;
  }

  function projectObject() {
    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: "GitHub loaded project",
      rootFile: state.rootFile,
      activePath: state.activePath,
      files: Object.assign({}, state.files),
      updatedAt: new Date().toISOString()
    };
  }

  function persistProject() {
    var p = projectObject();
    try {
      root.currentProject = Object.assign({}, root.currentProject || {}, p);
      root.project = root.currentProject;

      root.LuminaLatex = root.LuminaLatex || {};
      root.NS = root.NS || root.LuminaLatex;

      root.LuminaLatex.storageProject = p;
      root.LuminaLatex.project = root.currentProject;
      root.NS.storageProject = p;
      root.NS.project = root.currentProject;

      localStorage.setItem("latexai.step3d.stableGithubProject.v1", JSON.stringify(p));
    } catch (_) {}
  }

  function patchStorage() {
    if (!root.LAI_STORAGE || root.LAI_STORAGE.__step3dStablePatch) return;

    var storage = root.LAI_STORAGE;
    var oldApply = typeof storage.applyProject === "function" ? storage.applyProject.bind(storage) : null;
    var oldDiscover = typeof storage.discoverProject === "function" ? storage.discoverProject.bind(storage) : null;

    storage.applyProject = function (project) {
      scanProjectLike(project);
      state.rootFile = inferRoot(state.files, project && project.rootFile);
      if (project && project.activePath && state.files[norm(project.activePath)]) state.activePath = norm(project.activePath);
      state.lastLoadedAt = new Date().toISOString();
      persistProject();

      var ok = false;
      if (oldApply) {
        try { ok = !!oldApply(project); } catch (_) {}
      }

      // Restore full project after old apply potentially collapsed state.
      persistProject();
      setTimeout(function () { collect(); render(); }, 80);
      setTimeout(function () { collect(); render(); }, 500);
      return ok;
    };

    storage.discoverProject = function () {
      if (oldDiscover) {
        try { scanProjectLike(oldDiscover()); } catch (_) {}
      }
      collect();
      return projectObject();
    };

    storage.__step3dStablePatch = true;
  }

  function openFile(path, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }

    path = norm(path);
    if (!(path in state.files)) return;

    saveEditorIntoState();
    state.activePath = path;
    setDomActivePath(path);
    setEditorText(state.files[path]);
    persistProject();
    render();
  }

  function mkButton(label, onclick) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.margin = "2px";
    b.style.padding = "4px 7px";
    b.style.borderRadius = "7px";
    b.style.border = "1px solid #aaa";
    b.style.background = "#f7f7f7";
    b.style.color = "#111";
    b.style.font = "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      onclick(ev);
    }, true);
    return b;
  }

  function addTrackedFile() {
    saveEditorIntoState();
    var path = prompt("New tracked file path, e.g. sections/intro.tex or refs.bib");
    path = norm(path || "");
    if (!path) return;
    if (!validPath(path)) {
      alert("Unsupported or unsafe path: " + path);
      return;
    }
    if (!(path in state.files)) state.files[path] = "";
    openFile(path);
  }

  function render() {
    patchStorage();
    collect();

    var anchor = document.getElementById("fileTree");
    if (!anchor || !anchor.parentNode) return false;

    var panel = document.getElementById("lai-stable-github-file-list");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "lai-stable-github-file-list";
      panel.style.marginTop = "10px";
      panel.style.padding = "8px";
      panel.style.border = "1px solid rgba(0,0,0,0.15)";
      panel.style.borderRadius = "10px";
      panel.style.background = "rgba(255,255,255,0.75)";
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    }

    var paths = Object.keys(state.files || {}).sort();
    panel.innerHTML = "";

    var title = document.createElement("div");
    title.textContent = "GitHub loaded files (" + paths.length + ")";
    title.style.fontWeight = "700";
    title.style.marginBottom = "6px";
    panel.appendChild(title);

    var controls = document.createElement("div");
    controls.style.marginBottom = "6px";
    controls.appendChild(mkButton("Refresh", function () { saveEditorIntoState(); collect(); render(); }));
    controls.appendChild(mkButton("+ tracked file", addTrackedFile));
    panel.appendChild(controls);

    var list = document.createElement("div");
    list.style.maxHeight = "240px";
    list.style.overflow = "auto";
    list.style.webkitOverflowScrolling = "touch";

    paths.forEach(function (path) {
      var row = document.createElement("button");
      row.type = "button";
      row.textContent = path;
      row.title = path;
      row.style.display = "block";
      row.style.width = "100%";
      row.style.textAlign = "left";
      row.style.margin = "1px 0";
      row.style.padding = "5px 7px";
      row.style.border = "0";
      row.style.borderRadius = "7px";
      row.style.background = path === state.activePath ? "#e9eefc" : "transparent";
      row.style.color = "#111";
      row.style.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      row.addEventListener("click", function (ev) { openFile(path, ev); }, true);
      list.appendChild(row);
    });

    panel.appendChild(list);

    var note = document.createElement("div");
    note.style.fontSize = "11px";
    note.style.opacity = "0.75";
    note.style.marginTop = "5px";
    note.textContent = "Use this list for GitHub-loaded files. The original tree above may show only the app's active file.";
    panel.appendChild(note);

    return true;
  }

  function install() {
    patchStorage();
    collect();
    render();

    document.addEventListener("latexai:storage-project-applied", function () {
      setTimeout(function () { collect(); render(); }, 100);
      setTimeout(function () { collect(); render(); }, 700);
    });
    document.addEventListener("latexai:storage-loaded", function () {
      setTimeout(function () { collect(); render(); }, 100);
      setTimeout(function () { collect(); render(); }, 700);
    });

    var ed = editor();
    if (ed) {
      ed.addEventListener("input", function () {
        var path = getDomActivePath();
        if (validPath(path)) {
          state.files[path] = String(ed.value || "");
          persistProject();
        }
      });
    }

    // Render a few times only to survive app startup; no infinite fighting.
    [300, 1000, 2500].forEach(function (ms) {
      setTimeout(function () { collect(); render(); }, ms);
    });
  }

  root.LAI_STABLE_GITHUB_FILE_LIST = {
    STAGE: STAGE,
    render: render,
    collect: collect,
    openFile: openFile,
    getState: function () {
      collect();
      return {
        stage: STAGE,
        rootFile: state.rootFile,
        activePath: state.activePath,
        fileCount: Object.keys(state.files || {}).length,
        paths: Object.keys(state.files || {}).sort()
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  try { console.log("[Latexai Step3D] stable GitHub file list loaded", STAGE); } catch (_) {}
})();
