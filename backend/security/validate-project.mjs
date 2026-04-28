import { normalize } from 'node:path';

const DEFAULT_ALLOWED_EXTENSIONS = ['.tex', '.bib', '.sty', '.cls', '.txt', '.md', '.png', '.jpg', '.jpeg', '.pdf', '.eps'];

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function safeProjectId(value) {
  const id = String(value || '').trim();
  if (!id || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id)) throw httpError(400, 'Unsafe or empty project id.');
  return id;
}

export function safeRelativePath(value, allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  const path = normalize(raw).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!path || path === '.' || path.includes('..') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    throw httpError(400, `Unsafe or empty path: ${value}`);
  }
  if (/\0/.test(path)) throw httpError(400, `Unsafe path contains NUL byte: ${value}`);
  const lower = path.toLowerCase();
  if (!allowedExtensions.some((ext) => lower.endsWith(ext))) throw httpError(400, `Unsupported file extension: ${path}`);
  return path;
}

export function fileKind(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.tex')) return 'tex';
  if (lower.endsWith('.bib')) return 'bib';
  if (lower.endsWith('.sty')) return 'sty';
  if (lower.endsWith('.cls')) return 'cls';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.txt')) return 'text';
  if (/\.(png|jpg|jpeg|pdf|eps)$/i.test(lower)) return 'asset';
  return 'text';
}

export function isBinaryKind(kindOrPath) {
  const kind = String(kindOrPath || '');
  return kind === 'asset' || /\.(png|jpg|jpeg|pdf|eps)$/i.test(kind);
}

export function validateFiles(files, options = {}) {
  const maxProjectBytes = Number(options.maxProjectBytes || 4_000_000);
  const maxFileCount = Number(options.maxFileCount || 120);
  const allowedExtensions = options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;
  if (!Array.isArray(files) || !files.length) throw httpError(400, 'No files supplied.');
  if (files.length > maxFileCount) throw httpError(413, `Project has too many files. Limit is ${maxFileCount}.`);
  const seen = new Set();
  let bytes = 0;
  const out = [];
  for (const input of files) {
    const path = safeRelativePath(input?.path, allowedExtensions);
    if (seen.has(path)) throw httpError(400, `Duplicate file path: ${path}`);
    seen.add(path);
    const kind = input?.kind || fileKind(path);
    const encoding = input?.encoding || (input?.base64 ? 'base64' : 'utf8');
    let text = '';
    let base64 = '';
    if (encoding === 'base64' || input?.base64) {
      base64 = String(input?.base64 || input?.content || input?.text || '');
      if (!/^[A-Za-z0-9+/=\r\n]*$/.test(base64)) throw httpError(400, `Invalid base64 payload for ${path}.`);
      bytes += Buffer.byteLength(base64, 'base64');
    } else {
      text = String(input?.text ?? input?.content ?? '');
      bytes += Buffer.byteLength(text, 'utf8');
    }
    if (bytes > maxProjectBytes) throw httpError(413, `Project is larger than MAX_PROJECT_BYTES=${maxProjectBytes}.`);
    out.push({ id: input?.id || null, path, kind, encoding, text, base64 });
  }
  return out;
}

export function fileToBuffer(file) {
  if (file.encoding === 'base64' || file.base64) return Buffer.from(String(file.base64 || ''), 'base64');
  return Buffer.from(String(file.text ?? ''), 'utf8');
}

export function validateCompilePayload(body = {}, options = {}) {
  const files = validateFiles(body.files || [], options);
  const rootFile = safeRelativePath(body.rootFile || body.mainFile || 'main.tex', options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS);
  const root = files.find((file) => file.path === rootFile);
  if (!root) throw httpError(400, `Root file not found in project: ${rootFile}`);
  if (!root.path.endsWith('.tex')) throw httpError(400, 'Root file must be a .tex file.');
  return {
    ...body,
    schema: body.schema || 'lumina-latex-compile-request-v1',
    projectId: String(body.projectId || body.id || '').slice(0, 128),
    projectName: String(body.projectName || body.name || '').slice(0, 256),
    rootFile,
    mainFile: rootFile,
    engine: String(body.engine || 'pdflatex').trim(),
    bibliography: String(body.bibliography || 'bibtex').trim(),
    shellEscape: !!body.shellEscape,
    files,
    receivedAt: new Date().toISOString()
  };
}

export function normalizeProjectPayload(project = {}) {
  const p = project && typeof project === 'object' ? project : {};
  if (!Array.isArray(p.files) || !p.files.length) throw httpError(400, 'Project must include files.');
  validateFiles(p.files, { maxProjectBytes: Number(process.env.MAX_PROJECT_BYTES || 4_000_000) });
  return { ...p, schema: p.schema || 'lumina-latex-project-v1', updatedAt: new Date().toISOString() };
}
