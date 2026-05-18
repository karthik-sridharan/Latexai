/* Latexai Step 3C GitHub file-tree sync patch
 * Stage: latex-stage3c-github-filetree-sync-20260518-1
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3c-github-filetree-sync-20260518-1";
  var root = typeof window !== "undefined" ? window : globalThis;
  var state = { files: {}, rootFile: "main.tex", activePath: "main.tex", lastRenderAt: null };

  function norm(path) { return String(path || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""); }
  function textFrom(v) {
    if (typeof v === "string") return v;
    if (!v || typeof v !== "object") return null;
    var keys = ["content", "text", "source", "value", "data", "body"];
    for (var i = 0; i < keys.length; i++) if (typeof v[keys[i]] === "string") return v[keys[i]];
    return null;
  }
  function validPath(path) {
    path = norm(path);
    return path && !/(^|\/)\.\.(\/|$)/.test(path) &&
      !/(^|\/)(\.git|node_modules|dist|build|_minted)(\/|$)/.test(path) &&
      /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|bbx|cbx|ltx|png|jpg|jpeg|pdf|svg|eps)$/i.test(path);
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
  function scanLocalStorage(target) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!/(latex|latexai|lumina|project|file|store)/i.test(key || "")) continue;
        var obj = null;
        try { obj = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
        if (!obj || typeof obj !== "object") continue;
        mergeFiles(target, obj.files || obj.fileMap || obj.sources || obj.documents || obj.projectFiles);
        if (obj.project && typeof obj.project === "object") {
          mergeFiles(target, obj.project.files || obj.project.fileMap || obj.project.sources || obj.project.documents);
        }
      }
    } catch (_) {}
    return target;
  }
  function editor() { return document.getElementById("sourceEditor") || document.querySelector("textarea"); }
  function getActivePath() {
    var pill = document.getElementById("activeFilePill");
    return norm((pill && pill.textContent) || state.activePath || state.rootFile || "main.tex");
  }
  function setActivePath(path) {
    path = norm(path);
    state.activePath = path;
    var pill = document.getElementById("activeFilePill");
    if (pill) pill.textContent = path;
    var cursor = document.getElementById("cursorStatus");
    if (cursor) cursor.textContent = "Ln 1, Col 1";
  }
  function saveActiveEditor() {
    var ed = editor();
    var path = getActivePath();
    if (ed && path) {
      state.files[path] = String(ed.value || "");
      publishProject();
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
  function inferRoot(files) {
    if (state.rootFile && files[state.rootFile]) return state.rootFile;
    if (files["main.tex"]) return "main.tex";
    var tex = Object.keys(files).filter(function (p) { return /\.tex$/i.test(p); }).sort();
    return tex[0] || "main.tex";
  }
  function collectFiles() {
    var files = {};
    mergeFiles(files, state.files);

    try {
      if (root.LAI_STORAGE && typeof root.LAI_STORAGE.discoverProject === "function") {
        var p = root.LAI_STORAGE.discoverProject();
        mergeFiles(files, p && p.files);
        if (p && p.rootFile) state.rootFile = norm(p.rootFile);
        if (p && p.activePath) state.activePath = norm(p.activePath);
      }
    } catch (_) {}

    [
      root.currentProject,
      root.project,
      root.LatexaiProject,
      root.LuminaLatex && root.LuminaLatex.storageProject,
      root.LuminaLatex && root.LuminaLatex.project,
      root.NS && root.NS.storageProject,
      root.NS && root.NS.project
    ].forEach(function (p) {
      try {
        if (p && p.rootFile) state.rootFile = norm(p.rootFile);
        if (p && p.activePath) state.activePath = norm(p.activePath);
        mergeFiles(files, p && p.files);
      } catch (_) {}
    });

    scanLocalStorage(files);

    var ed = editor();
    var active = getActivePath();
    if (ed && active && String(ed.value || "").trim()) files[active] = String(ed.value || "");

    state.files = files;
    state.rootFile = inferRoot(files);
    if (!state.activePath || !files[state.activePath]) state.activePath = state.rootFile;
    publishProject();
    return files;
  }
  function publishProject() {
    var project = {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: "GitHub loaded project",
      rootFile: state.rootFile,
      activePath: state.activePath,
      files: state.files,
      updatedAt: new Date().toISOString()
    };
    try {
      root.currentProject = Object.assign({}, root.currentProject || {}, project);
      root.project = root.currentProject;
      root.LuminaLatex = root.LuminaLatex || {};
      root.NS = root.NS || root.LuminaLatex;
      root.LuminaLatex.project = root.currentProject;
      root.LuminaLatex.storageProject = project;
      root.NS.project = root.currentProject;
      root.NS.storageProject = project;
      if (root.LAI_STORAGE) {
        if (typeof root.LAI_STORAGE.updateKnownFiles === "function") root.LAI_STORAGE.updateKnownFiles(state.files);
        if (typeof root.LAI_STORAGE.registerFile === "function") root.LAI_STORAGE.registerFile(state.activePath, state.files[state.activePath] || "");
      }
      localStorage.setItem("latexai.step3c.filetree.project.v1", JSON.stringify(project));
    } catch (_) {}
  }
  function openFile(path) {
    path = norm(path);
    if (!(path in state.files)) return;
    saveActiveEditor();
    state.activePath = path;
    setActivePath(path);
    setEditorText(state.files[path]);
    publishProject();
    render();
  }
  function button(label, onClick, small) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.margin = "2px";
    b.style.padding = small ? "3px 6px" : "5px 7px";
    b.style.borderRadius = "7px";
    b.style.border = "1px solid #aaa";
    b.style.background = "#f7f7f7";
    b.style.color = "#111";
    b.style.font = "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    b.addEventListener("click", onClick);
    return b;
  }
  function addTrackedFile() {
    saveActiveEditor();
    var path = prompt("New tracked file path, e.g. sections/intro.tex or refs.bib");
    path = norm(path || "");
    if (!path) return;
    if (!validPath(path)) { alert("Unsupported or unsafe path: " + path); return; }
    if (!(path in state.files)) state.files[path] = "";
    openFile(path);
    render();
  }
  function render() {
    var tree = document.getElementById("fileTree");
    if (!tree) return false;
    var files = collectFiles();
    var paths = Object.keys(files).sort();
    if (!paths.length) return false;

    tree.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.id = "lai-file-tree-sync";
    wrap.style.fontSize = "13px";

    var title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.margin = "0 0 6px 0";
    title.textContent = "Loaded project files (" + paths.length + ")";
    wrap.appendChild(title);

    var controls = document.createElement("div");
    controls.style.marginBottom = "6px";
    controls.appendChild(button("Refresh", function () { saveActiveEditor(); render(); }, true));
    controls.appendChild(button("+ tracked file", addTrackedFile, true));
    wrap.appendChild(controls);

    paths.forEach(function (path) {
      var row = document.createElement("button");
      row.type = "button";
      row.textContent = path;
      row.title = path;
      row.dataset.path = path;
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
      row.addEventListener("click", function () { openFile(path); });
      wrap.appendChild(row);
    });

    tree.appendChild(wrap);
    state.lastRenderAt = new Date().toISOString();
    return true;
  }
  function install() {
    collectFiles();
    render();
    document.addEventListener("latexai:storage-project-applied", function () { setTimeout(render, 100); });
    document.addEventListener("latexai:storage-loaded", function () { setTimeout(render, 100); });
    document.addEventListener("latexai:storage-saved", function () { setTimeout(render, 100); });

    var ed = editor();
    if (ed) {
      ed.addEventListener("input", function () {
        var path = getActivePath();
        if (path) state.files[path] = String(ed.value || "");
      });
    }

    var n = 0;
    var id = setInterval(function () {
      n += 1;
      render();
      if (n >= 12) clearInterval(id);
    }, 750);
  }

  root.LAI_FILE_TREE_SYNC = {
    STAGE: STAGE,
    render: render,
    collectFiles: collectFiles,
    openFile: openFile,
    addTrackedFile: addTrackedFile,
    getState: function () {
      return {
        stage: STAGE,
        rootFile: state.rootFile,
        activePath: state.activePath,
        fileCount: Object.keys(state.files || {}).length,
        paths: Object.keys(state.files || {}).sort(),
        lastRenderAt: state.lastRenderAt
      };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  try { console.log("[Latexai FileTreeSync] loaded", STAGE); } catch (_) {}
})();
