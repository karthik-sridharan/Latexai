(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const FALLBACK_MODELS = {
    openai: [
      { value: 'gpt-4.1-mini', label: 'OpenAI · gpt-4.1-mini' },
      { value: 'gpt-4.1', label: 'OpenAI · gpt-4.1' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-5', label: 'Claude · claude-sonnet-4-5' },
      { value: 'claude-haiku-4-5', label: 'Claude · claude-haiku-4-5' }
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini · gemini-2.5-flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini · gemini-2.5-pro' }
    ]
  };

  const LS_PROVIDER = 'lumina-latex.ai.provider';
  const LS_MODEL_PREFIX = 'lumina-latex.ai.model.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';

  function init() {
    bindProviderPicker();
    document.getElementById('askCopilotBtn')?.addEventListener('click', askCopilot);
    document.getElementById('insertCopilotBtn')?.addEventListener('click', insertCopilotResult);
    document.getElementById('replaceCopilotBtn')?.addEventListener('click', replaceWithCopilotResult);
  }

  function bindProviderPicker() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    const proxyUrlEl = document.getElementById('aiProxyUrl');
    const proxyTokenEl = document.getElementById('aiProxyToken');
    if (!providerEl || !modelEl) return;

    providerEl.value = localStorage.getItem(LS_PROVIDER) || 'openai';
    if (proxyUrlEl) proxyUrlEl.value = localStorage.getItem(LS_PROXY_URL) || proxyUrlEl.value || '/api/lumina/ai';
    if (proxyTokenEl) proxyTokenEl.value = localStorage.getItem(LS_PROXY_TOKEN) || '';

    renderModels();
    loadModelsFromProxy();

    providerEl.addEventListener('change', () => {
      localStorage.setItem(LS_PROVIDER, providerEl.value);
      renderModels();
    });
    modelEl.addEventListener('change', () => localStorage.setItem(`${LS_MODEL_PREFIX}${providerEl.value}`, modelEl.value));
    proxyUrlEl?.addEventListener('change', () => {
      localStorage.setItem(LS_PROXY_URL, proxyUrlEl.value.trim() || '/api/lumina/ai');
      loadModelsFromProxy();
    });
    proxyTokenEl?.addEventListener('change', () => localStorage.setItem(LS_PROXY_TOKEN, proxyTokenEl.value.trim()));
  }

  function modelsFor(provider) {
    return NS.AIProvider?.modelsFor?.(provider) || FALLBACK_MODELS[provider] || [];
  }

  function renderModels() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    if (!providerEl || !modelEl) return;
    const provider = providerEl.value || 'openai';
    const models = modelsFor(provider);
    modelEl.innerHTML = models.map((m) => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label || m.value)}</option>`).join('');
    const saved = localStorage.getItem(`${LS_MODEL_PREFIX}${provider}`);
    if (saved && models.some((m) => m.value === saved)) modelEl.value = saved;
  }

  async function loadModelsFromProxy() {
    const ok = await NS.AIProvider?.loadModelsFromProxy?.();
    if (ok) renderModels();
    return !!ok;
  }

  function getProxyUrl() {
    return document.getElementById('aiProxyUrl')?.value?.trim() || localStorage.getItem(LS_PROXY_URL) || '/api/lumina/ai';
  }

  function getConfig() {
    return NS.AIProvider?.getConfig?.() || { provider: 'openai', model: '', proxyUrl: getProxyUrl(), proxyToken: '' };
  }

  async function callProxy(payload, meta = {}) {
    return NS.AIProvider.ask(payload, meta);
  }

  function extractText(data) {
    return NS.AIProvider?.extractText?.(data) || JSON.stringify(data, null, 2);
  }

  async function askCopilot() {
    const button = document.getElementById('askCopilotBtn');
    const output = document.getElementById('copilotOutput');
    const prompt = document.getElementById('copilotPrompt')?.value || '';
    const task = document.getElementById('copilotTask')?.value || 'latex-copilot';
    const file = State().getActiveFile();
    const selection = NS.Editor?.getSelection?.() || { text: '' };
    if (!prompt.trim() && !selection.text.trim() && task !== 'fix-error' && task !== 'explain-log') {
      output.textContent = 'Add a prompt or select LaTeX in the editor first.';
      return;
    }
    if (button) button.disabled = true;
    output.textContent = 'Calling AI proxy…';
    try {
      const system = systemPromptFor(task);
      const user = [
        `Task: ${task}`,
        `Project: ${State().state.project.name}`,
        `Active file: ${file?.path || 'none'}`,
        selection.text ? `Selected LaTeX:\n${selection.text}` : '',
        `User prompt:\n${prompt}`,
        `Current compile/draft diagnostics:\n${State().state.lastProblems.map((p) => `${p.level}: ${p.message}`).join('\n')}`,
        `Compile log:\n${State().state.lastLog.slice(-4000)}`,
        `Active file content:\n${(file?.text || '').slice(0, 12000)}`
      ].filter(Boolean).join('\n\n---\n\n');
      const result = await callProxy({ instructions: system, input: user, temperature: 0.25, maxOutputTokens: 4500 }, { task });
      output.textContent = extractText(result) || 'No text returned by proxy.';
    } catch (err) {
      output.textContent = `AI proxy error: ${err.message || err}\n\nMake sure backend/server.mjs is running and the proxy URL is correct. Provider API keys should live only on the backend.`;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function systemPromptFor(task) {
    const base = 'You are Lumina LaTeX Copilot. Help edit LaTeX source. Prefer concise, directly usable LaTeX. Do not wrap the answer in Markdown fences unless explicitly asked.';
    if (task === 'fix-error') return `${base} Diagnose the compile issue and return the corrected LaTeX snippet or concrete patch.`;
    if (task === 'rewrite-selection') return `${base} Rewrite the selected LaTeX while preserving mathematical meaning.`;
    if (task === 'new-section') return `${base} Draft a polished LaTeX section or subsection that can be inserted directly.`;
    if (task === 'beamer-outline') return `${base} Return a Beamer-compatible outline with frames and concise bullets.`;
    if (task === 'explain-log') return `${base} Explain the LaTeX compile log and give a fix-first checklist.`;
    return base;
  }

  function copilotText() {
    return document.getElementById('copilotOutput')?.textContent || '';
  }

  function insertCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.insertText?.('\n' + text + '\n');
  }

  function replaceWithCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.replaceSelection?.(text, true);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  NS.Copilot = { init, models: null, getConfig, callProxy, extractText, askCopilot };
})();
