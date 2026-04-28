(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const Model = () => NS.ProjectModel;

  function createLocalOnlySyncProvider() {
    return {
      name: 'local-only',
      connected: true,
      websocket: false,
      async save(project, settings) {
        const result = NS.ProjectStore.saveLocal(project, settings);
        return { ok: true, mode: 'local-only', savedAt: result.savedAt };
      },
      async load() {
        const result = NS.ProjectStore.loadLocal();
        return { ok: true, mode: 'local-only', ...result };
      },
      connect() { return { ok: true, mode: 'local-only' }; },
      disconnect() { return { ok: true, mode: 'local-only' }; }
    };
  }

  function createHttpProjectSyncProvider(options = {}) {
    const baseUrl = options.baseUrl || '/api/lumina/projects';
    const token = options.token || '';
    function headers() {
      const out = { 'Content-Type': 'application/json' };
      if (token) out.Authorization = `Bearer ${token}`;
      return out;
    }
    return {
      name: 'http-project',
      connected: false,
      websocket: false,
      async save(project, settings) {
        const normalized = Model().normalizeProject(project);
        const response = await fetch(`${baseUrl}/${encodeURIComponent(normalized.projectId)}`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ schema: 'lumina-latex-project-save-v1', project: normalized, settings })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data?.error?.message || `HTTP project save failed: ${response.status}`);
        return data;
      },
      async load(projectId) {
        const response = await fetch(`${baseUrl}/${encodeURIComponent(projectId)}`, { headers: headers() });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data?.error?.message || `HTTP project load failed: ${response.status}`);
        return { ok: true, mode: 'http-project', project: Model().normalizeProject(data.project), settings: data.settings || {} };
      }
    };
  }

  function createWebSocketSyncProvider(options = {}) {
    const provider = {
      name: 'websocket-placeholder',
      url: options.url || '/ws/lumina/projects',
      connected: false,
      websocket: true,
      socket: null,
      connect(projectId) {
        return {
          ok: false,
          mode: 'websocket-placeholder',
          projectId,
          message: 'Stage 1C reserves the WebSocket contract but does not open a collaboration socket yet.'
        };
      },
      disconnect() {
        if (provider.socket) provider.socket.close();
        provider.socket = null;
        provider.connected = false;
        return { ok: true };
      },
      makeMessage(type, payload = {}) {
        return { schema: 'lumina-latex-sync-event-v1', type, payload, sentAt: new Date().toISOString() };
      }
    };
    return provider;
  }

  function providerForSettings(settings = {}) {
    const mode = settings.syncMode || 'local-only';
    if (mode === 'http-project') return createHttpProjectSyncProvider({ baseUrl: settings.httpProjectUrl, token: settings.syncToken });
    if (mode === 'websocket') return createWebSocketSyncProvider({ url: settings.websocketUrl });
    return createLocalOnlySyncProvider();
  }

  NS.SyncProvider = {
    createLocalOnlySyncProvider,
    createHttpProjectSyncProvider,
    createWebSocketSyncProvider,
    providerForSettings
  };
})();
