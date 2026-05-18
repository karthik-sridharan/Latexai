/* Latexai Step 2A Storage UI - iPad upload version
 * Drop this file at: js/lai-storage-ui.js
 * Load after js/lai-storage-provider-preload.js.
 */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;

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

  function fmtTime(iso) {
    if (!iso) return "never";
    try { return new Date(iso).toLocaleTimeString(); } catch (_) { return iso; }
  }

  function init() {
    var storage = root.LAI_STORAGE;
    if (!storage) {
      console.warn("[Latexai Storage UI] LAI_STORAGE not found.");
      return;
    }

    if (document.getElementById("lai-storage-panel")) return;

    var panel = h("div", {
      id: "lai-storage-panel",
      style: {
        position: "fixed",
        right: "12px",
        bottom: "12px",
        zIndex: "999999",
        width: "280px",
        background: "rgba(255,255,255,0.97)",
        color: "#111",
        border: "1px solid #bbb",
        borderRadius: "10px",
        boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
        font: "13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "10px"
      }
    });

    var title = h("div", {
      text: "Latexai Storage",
      style: { fontWeight: "700", marginBottom: "6px" }
    });

    var status = h("div", {
      id: "lai-storage-status",
      style: { lineHeight: "1.35", marginBottom: "8px", whiteSpace: "pre-wrap" }
    });

    function btn(label) {
      return h("button", {
        type: "button",
        style: {
          margin: "2px",
          padding: "5px 7px",
          borderRadius: "7px",
          border: "1px solid #aaa",
          background: "#f7f7f7",
          color: "#111",
          font: "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        },
        text: label
      });
    }

    var saveBtn = btn("Save Now");
    var loadBtn = btn("Load Autosave");
    var folderBtn = btn("Open Local Folder");
    var hideBtn = btn("Hide");

    var controls = h("div", {}, [saveBtn, loadBtn, folderBtn, hideBtn]);
    panel.appendChild(title);
    panel.appendChild(status);
    panel.appendChild(controls);
    document.body.appendChild(panel);

    function refresh(extra) {
      var s = storage.getStatus();
      status.textContent =
        "Mode: " + s.mode + "\n" +
        "Autosave: " + (s.autosave ? "on" : "off") + "\n" +
        "Native folder: " + (s.nativeFolderSupported ? "available" : "unavailable") + "\n" +
        "Last saved: " + fmtTime(s.lastSavedAt) + "\n" +
        (s.lastError ? "Error: " + s.lastError + "\n" : "") +
        (extra ? String(extra) : "");
      folderBtn.disabled = !s.nativeFolderSupported;
      folderBtn.style.opacity = s.nativeFolderSupported ? "1" : "0.5";
    }

    saveBtn.addEventListener("click", async function () {
      status.textContent = "Saving...";
      var r = await storage.saveNow();
      refresh(r.ok ? "Saved." : ("Save failed: " + r.message));
    });

    loadBtn.addEventListener("click", async function () {
      status.textContent = "Loading autosave...";
      var r = await storage.loadAutosave();
      refresh(r.ok ? "Loaded autosave." : (r.message || "No autosave found."));
    });

    folderBtn.addEventListener("click", async function () {
      status.textContent = "Opening local folder...";
      var r = await storage.openNativeFolder();
      refresh(r.ok ? "Folder loaded." : (r.message || "Folder unavailable."));
    });

    hideBtn.addEventListener("click", function () {
      panel.style.display = "none";
      var reopen = h("button", {
        id: "lai-storage-reopen",
        type: "button",
        text: "Storage",
        style: {
          position: "fixed",
          right: "12px",
          bottom: "12px",
          zIndex: "999999",
          borderRadius: "999px",
          border: "1px solid #aaa",
          background: "#fff",
          color: "#111",
          padding: "7px 10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          font: "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        }
      });
      reopen.addEventListener("click", function () {
        panel.style.display = "";
        reopen.remove();
        refresh();
      });
      document.body.appendChild(reopen);
    });

    document.addEventListener("latexai:storage-saved", function () { refresh(); });
    document.addEventListener("latexai:storage-loaded", function () { refresh(); });
    document.addEventListener("latexai:storage-dirty", function () { refresh(); });

    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
