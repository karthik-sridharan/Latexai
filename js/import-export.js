(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  function init() {
    document.getElementById('importFilesBtn')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
    document.getElementById('importFileInput')?.addEventListener('change', importFilesFromInput);
    document.getElementById('exportZipBtn')?.addEventListener('click', exportZip);
    document.getElementById('downloadActiveBtn')?.addEventListener('click', downloadActiveFile);
    document.getElementById('openOverleafBtn')?.addEventListener('click', openRootInOverleaf);
  }

  async function importFilesFromInput(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const settings = Object.assign({}, State().state.settings || {}, State().state.project?.settings || {});

    // A full Chuvadi project JSON remains the strongest import format.
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
      const text = await files[0].text();
      try {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.files)) {
          const ok = confirm(`Import project JSON and replace the current project with “${parsed.name || files[0].name}”?\n\nThis imports files and project metadata. Project memory starts from this imported workspace unless the JSON includes existing project IDs.`);
          if (ok) {
            parsed.settings = Object.assign({}, settings, parsed.settings || {});
            State().resetProject(parsed);
            await W.LuminaLatex.ProjectWorkspaceService?.restoreForProject?.(State().state.project, { source: 'import-project-json', silent: true });
            State().save();
            W.LuminaLatex.Preview?.renderDraftPreview?.();
            W.LuminaLatex.Main?.toast?.('Project imported.');
          }
          event.target.value = '';
          return;
        }
      } catch (_err) {
        // fall through to generic file import
      }
    }

    const projectName = prompt('Imported project name', guessImportedProjectName(files));
    if (!projectName || !String(projectName).trim()) {
      event.target.value = '';
      return;
    }
    if (!confirm(`Import ${files.length} file${files.length === 1 ? '' : 's'} as a fresh project “${projectName}”?\n\nThis replaces the current editor project. It starts with empty project memory and no GitHub attachment until you save/create a GitHub-backed project.`)) {
      event.target.value = '';
      return;
    }

    const importedFiles = [];
    for (const file of files) {
      const path = State().normalizePath(file.webkitRelativePath || file.name);
      if (!path) continue;
      if (isLikelyText(file.name)) {
        importedFiles.push({ path, kind: path.toLowerCase().endsWith('.tex') ? 'tex' : 'support', text: await file.text() });
      } else {
        importedFiles.push({ path, kind: 'asset', text: '', encoding: 'base64', base64: await fileToBase64(file) });
      }
    }
    if (!importedFiles.length) {
      W.LuminaLatex.Main?.toast?.('No supported files were imported.');
      event.target.value = '';
      return;
    }
    const defaultProject = State().defaultProject();
    const rootFile = importedFiles.find((f) => f.path === 'main.tex')?.path || importedFiles.find((f) => /\.tex$/i.test(f.path))?.path || importedFiles[0].path;
    const now = new Date().toISOString();
    const projectId = W.LuminaLatex.ProjectModel?.uid?.('imported-project') || `imported-project-${Date.now()}`;
    const project = Object.assign({}, defaultProject, {
      name: String(projectName).trim(),
      title: String(projectName).trim(),
      projectId,
      id: projectId,
      paperId: `imported-paper-${Date.now().toString(36)}`,
      rootFile,
      activePath: rootFile,
      files: importedFiles,
      settings,
      github: null,
      createdAt: now,
      updatedAt: now,
      meta: {
        importedProject: true,
        importedAt: now,
        importedFileCount: importedFiles.length,
        projectWorkspaceFreshMemory: true,
        importStage: 'stage19w42-project-actions-workspace-ui-20260605-1'
      }
    });
    State().resetProject(project);
    await W.LuminaLatex.ProjectWorkspaceService?.restoreForProject?.(State().state.project, { source: 'import-project-files', silent: true });
    State().save();
    W.LuminaLatex.Preview?.renderDraftPreview?.();
    W.LuminaLatex.Main?.toast?.(`Imported project with ${importedFiles.length} file${importedFiles.length === 1 ? '' : 's'}.`);
    event.target.value = '';
  }

  function isLikelyText(name) {
    return /\.(tex|bib|sty|cls|bst|txt|md|log|aux|json|yaml|yml|csv)$/i.test(name || '');
  }

  function guessImportedProjectName(files) {
    const firstTex = Array.from(files || []).find((file) => /\.tex$/i.test(file.name || ''));
    const first = firstTex || Array.from(files || [])[0];
    const raw = first?.webkitRelativePath ? String(first.webkitRelativePath).split('/')[0] : String(first?.name || 'Imported LatexAI Project').replace(/\.[^.]+$/, '');
    return raw || 'Imported LatexAI Project';
  }

  function downloadActiveFile() {
    const file = State().getActiveFile();
    if (!file) return;
    downloadFile(file.path);
  }

  function downloadFile(path) {
    const file = State().getFile?.(path) || (State().state.project.files || []).find((item) => item.path === path);
    if (!file) return;
    const content = file.encoding === 'base64' && file.base64 ? base64ToBytes(file.base64) : (file.text || '');
    const blob = content instanceof Uint8Array ? new Blob([content], { type: 'application/octet-stream' }) : new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, basename(file.path));
  }

  function exportProjectJson() {
    const project = State().state.project;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, slug(project.name || 'lumina-latex-project') + '.json');
  }

  function exportZip() {
    State().save();
    const project = State().state.project;
    const files = project.files.map((file) => ({ path: file.path, content: file.text || '', base64: file.base64 || '', encoding: file.encoding || 'utf8' }));
    files.push({ path: 'lumina-project.json', content: JSON.stringify(project, null, 2) });
    files.push({ path: 'README_CHUVADI.txt', content: `Chuvadi export\nProject: ${project.name}\nRoot file: ${project.rootFile}\nStage: ${State().STAGE}\n` });
    const blob = makeZip(files);
    downloadBlob(blob, slug(project.name || 'lumina-latex-project') + '.zip');
  }

  // Tiny no-compression ZIP writer for browser-only project export.
  function makeZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const name = State().normalizePath(file.path || 'file.txt');
      const nameBytes = encoder.encode(name);
      const contentBytes = file.encoding === 'base64' && file.base64 ? base64ToBytes(file.base64) : encoder.encode(String(file.content ?? ''));
      const crc = crc32(contentBytes);
      const mod = dosDateTime(new Date());

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, mod.time, true);
      lv.setUint16(12, mod.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, contentBytes.length, true);
      lv.setUint32(22, contentBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      localParts.push(local, contentBytes);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, mod.time, true);
      cv.setUint16(14, mod.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, contentBytes.length, true);
      cv.setUint32(24, contentBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length + contentBytes.length;
    }

    const centralStart = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralStart, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  let crcTable = null;
  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    if (!crcTable) crcTable = makeCrcTable();
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
      reader.onerror = () => reject(reader.error || new Error('File read failed.'));
      reader.readAsDataURL(file);
    });
  }

  function base64ToBytes(base64) {
    const binary = atob(String(base64 || '').replace(/\s+/g, ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slug(value) {
    return String(value || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'project';
  }

  function basename(path) {
    return String(path || 'file.txt').split('/').pop() || 'file.txt';
  }


  function openRootInOverleaf() {
    State().save();
    const project = State().state.project;
    const rootFile = State().getFile(project.rootFile) || State().getActiveFile();
    const source = rootFile?.text || '';
    if (!source.trim()) {
      W.LuminaLatex.Main?.toast?.('No root LaTeX source to send to Overleaf.');
      return;
    }
    const form = document.createElement('form');
    form.action = 'https://www.overleaf.com/docs';
    form.method = 'post';
    form.target = '_blank';
    form.style.display = 'none';
    addHidden(form, 'encoded_snip', encodeURIComponent(source.replace(/\r\n?/g, '\n')));
    addHidden(form, 'snip_name', rootFile.path || 'main.tex');
    addHidden(form, 'main_document', rootFile.path || 'main.tex');
    const engine = State().state.settings?.engine || 'pdflatex';
    if (['pdflatex','xelatex','lualatex'].includes(engine)) addHidden(form, 'engine', engine);
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => form.remove(), 1000);
    W.LuminaLatex.Main?.toast?.('Opening root file in Overleaf.');
  }

  function addHidden(form, name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  NS.ImportExport = { init, exportZip, exportProjectJson, downloadActiveFile, downloadFile, openRootInOverleaf, makeZip };
})();
