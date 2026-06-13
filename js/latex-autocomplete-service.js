/* LaTeX Autocomplete Service
 * Stage: stage19w57-latex-autocomplete-1
 *
 * Shows a filtered command dropdown whenever the user types \ in #sourceEditor.
 * Arrow/Tab/Enter selects; Escape or clicking outside dismisses.
 * Inserts snippet with cursor positioned inside the first {}.
 *
 * No external dependencies.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19w57-latex-autocomplete-1';

  // ── Command list ─────────────────────────────────────────────────────────────
  // Each entry: [trigger (what user types after \), snippet (what gets inserted), description]
  // Use "|" to mark cursor position inside snippet.
  const COMMANDS = [
    // ── Sectioning ───────────────────────────────────────────────────────────
    ['section',        '\\section{|}',                     'Section heading'],
    ['subsection',     '\\subsection{|}',                  'Subsection heading'],
    ['subsubsection',  '\\subsubsection{|}',               'Subsubsection heading'],
    ['paragraph',      '\\paragraph{|}',                   'Named paragraph'],
    ['subparagraph',   '\\subparagraph{|}',                'Subparagraph'],
    ['chapter',        '\\chapter{|}',                     'Chapter heading'],
    ['part',           '\\part{|}',                        'Part heading'],
    // ── Text formatting ──────────────────────────────────────────────────────
    ['textbf',         '\\textbf{|}',                      'Bold text'],
    ['textit',         '\\textit{|}',                      'Italic text'],
    ['texttt',         '\\texttt{|}',                      'Monospace text'],
    ['emph',           '\\emph{|}',                        'Emphasized text'],
    ['underline',      '\\underline{|}',                   'Underlined text'],
    ['textrm',         '\\textrm{|}',                      'Roman (normal) font'],
    ['textsf',         '\\textsf{|}',                      'Sans-serif font'],
    ['textsc',         '\\textsc{|}',                      'Small caps'],
    ['textcolor',      '\\textcolor{|}{text}',             'Colored text'],
    ['colorbox',       '\\colorbox{|}{text}',              'Colored box'],
    ['footnote',       '\\footnote{|}',                    'Footnote'],
    ['marginpar',      '\\marginpar{|}',                   'Margin note'],
    ['textwidth',      '\\textwidth',                      'Text width dimension'],
    ['linewidth',      '\\linewidth',                      'Line width dimension'],
    // ── Font size ────────────────────────────────────────────────────────────
    ['tiny',           '{\\tiny |}',                       'Tiny font size'],
    ['scriptsize',     '{\\scriptsize |}',                 'Script font size'],
    ['footnotesize',   '{\\footnotesize |}',               'Footnote font size'],
    ['small',          '{\\small |}',                      'Small font size'],
    ['normalsize',     '{\\normalsize |}',                  'Normal font size'],
    ['large',          '{\\large |}',                      'Large font size'],
    ['Large',          '{\\Large |}',                      'Larger font size'],
    ['LARGE',          '{\\LARGE |}',                      'Even larger'],
    ['huge',           '{\\huge |}',                       'Huge font size'],
    ['Huge',           '{\\Huge |}',                       'Hugest font size'],
    // ── Document structure ───────────────────────────────────────────────────
    ['documentclass',  '\\documentclass[|]{article}',     'Document class'],
    ['usepackage',     '\\usepackage{|}',                  'Import package'],
    ['begin',          '\\begin{|}\n\n\\end{}',            'Begin environment'],
    ['end',            '\\end{|}',                         'End environment'],
    ['input',          '\\input{|}',                       'Include file (no standalone)'],
    ['include',        '\\include{|}',                     'Include file (standalone)'],
    ['bibliography',   '\\bibliography{|}',                'Bibliography file'],
    ['bibliographystyle', '\\bibliographystyle{|}',        'Bibliography style'],
    // ── Math ─────────────────────────────────────────────────────────────────
    ['frac',           '\\frac{|}{denominator}',           'Fraction'],
    ['sqrt',           '\\sqrt{|}',                        'Square root'],
    ['sum',            '\\sum_{i=|}^{n}',                  'Summation'],
    ['prod',           '\\prod_{i=|}^{n}',                 'Product'],
    ['int',            '\\int_{|}^{}',                     'Integral'],
    ['iint',           '\\iint_{|}^{}',                    'Double integral'],
    ['iiint',          '\\iiint_{|}^{}',                   'Triple integral'],
    ['oint',           '\\oint_{|}^{}',                    'Contour integral'],
    ['lim',            '\\lim_{| \\to \\infty}',           'Limit'],
    ['infty',          '\\infty',                          'Infinity'],
    ['partial',        '\\partial',                        'Partial derivative'],
    ['nabla',          '\\nabla',                          'Gradient/nabla'],
    ['alpha',          '\\alpha',                          'α'],
    ['beta',           '\\beta',                           'β'],
    ['gamma',          '\\gamma',                          'γ'],
    ['Gamma',          '\\Gamma',                          'Γ'],
    ['delta',          '\\delta',                          'δ'],
    ['Delta',          '\\Delta',                          'Δ'],
    ['epsilon',        '\\epsilon',                        'ε'],
    ['varepsilon',     '\\varepsilon',                     'ε (variant)'],
    ['zeta',           '\\zeta',                           'ζ'],
    ['eta',            '\\eta',                            'η'],
    ['theta',          '\\theta',                          'θ'],
    ['Theta',          '\\Theta',                          'Θ'],
    ['iota',           '\\iota',                           'ι'],
    ['kappa',          '\\kappa',                          'κ'],
    ['lambda',         '\\lambda',                         'λ'],
    ['Lambda',         '\\Lambda',                         'Λ'],
    ['mu',             '\\mu',                             'μ'],
    ['nu',             '\\nu',                             'ν'],
    ['xi',             '\\xi',                             'ξ'],
    ['pi',             '\\pi',                             'π'],
    ['Pi',             '\\Pi',                             'Π'],
    ['rho',            '\\rho',                            'ρ'],
    ['sigma',          '\\sigma',                          'σ'],
    ['Sigma',          '\\Sigma',                          'Σ'],
    ['tau',            '\\tau',                            'τ'],
    ['phi',            '\\phi',                            'φ'],
    ['Phi',            '\\Phi',                            'Φ'],
    ['chi',            '\\chi',                            'χ'],
    ['psi',            '\\psi',                            'ψ'],
    ['Psi',            '\\Psi',                            'Ψ'],
    ['omega',          '\\omega',                          'ω'],
    ['Omega',          '\\Omega',                          'Ω'],
    ['times',          '\\times',                          '×'],
    ['cdot',           '\\cdot',                           '·'],
    ['cdots',          '\\cdots',                          '⋯'],
    ['ldots',          '\\ldots',                          '…'],
    ['vdots',          '\\vdots',                          '⋮'],
    ['ddots',          '\\ddots',                          '⋱'],
    ['leq',            '\\leq',                            '≤'],
    ['geq',            '\\geq',                            '≥'],
    ['neq',            '\\neq',                            '≠'],
    ['approx',         '\\approx',                         '≈'],
    ['equiv',          '\\equiv',                          '≡'],
    ['sim',            '\\sim',                            '∼'],
    ['simeq',          '\\simeq',                          '≃'],
    ['subset',         '\\subset',                         '⊂'],
    ['subseteq',       '\\subseteq',                       '⊆'],
    ['supset',         '\\supset',                         '⊃'],
    ['supseteq',       '\\supseteq',                       '⊇'],
    ['in',             '\\in',                             '∈'],
    ['notin',          '\\notin',                          '∉'],
    ['cup',            '\\cup',                            '∪'],
    ['cap',            '\\cap',                            '∩'],
    ['forall',         '\\forall',                         '∀'],
    ['exists',         '\\exists',                         '∃'],
    ['neg',            '\\neg',                            '¬'],
    ['land',           '\\land',                           '∧'],
    ['lor',            '\\lor',                            '∨'],
    ['Rightarrow',     '\\Rightarrow',                     '⇒'],
    ['Leftarrow',      '\\Leftarrow',                      '⇐'],
    ['Leftrightarrow', '\\Leftrightarrow',                 '⇔'],
    ['rightarrow',     '\\rightarrow',                     '→'],
    ['leftarrow',      '\\leftarrow',                      '←'],
    ['leftrightarrow', '\\leftrightarrow',                 '↔'],
    ['to',             '\\to',                             '→ (arrow)'],
    ['gets',           '\\gets',                           '← (arrow)'],
    ['mapsto',         '\\mapsto',                         '↦'],
    ['hat',            '\\hat{|}',                         'Hat accent'],
    ['bar',            '\\bar{|}',                         'Bar accent'],
    ['tilde',          '\\tilde{|}',                       'Tilde accent'],
    ['vec',            '\\vec{|}',                         'Vector arrow'],
    ['overline',       '\\overline{|}',                    'Overline'],
    ['underline',      '\\underline{|}',                   'Underline'],
    ['overbrace',      '\\overbrace{|}^{}',                'Overbrace'],
    ['underbrace',     '\\underbrace{|}^{}',               'Underbrace'],
    ['mathbb',         '\\mathbb{|}',                      'Blackboard bold (ℝ, ℕ…)'],
    ['mathbf',         '\\mathbf{|}',                      'Math bold'],
    ['mathcal',        '\\mathcal{|}',                     'Calligraphic'],
    ['mathrm',         '\\mathrm{|}',                      'Math roman'],
    ['mathit',         '\\mathit{|}',                      'Math italic'],
    ['text',           '\\text{|}',                        'Text inside math'],
    ['operatorname',   '\\operatorname{|}',                'Custom operator name'],
    ['left',           '\\left(|\\right)',                 'Auto-sized delimiters'],
    ['binom',          '\\binom{|}{k}',                    'Binomial coefficient'],
    ['norm',           '\\||\\ \\|',                       'Norm delimiters'],
    ['abs',            '\\left||\\right|',                 'Absolute value delimiters'],
    // ── Environments ─────────────────────────────────────────────────────────
    ['equation',       '\\begin{equation}\n  |\n\\end{equation}',    'Numbered equation'],
    ['equation*',      '\\begin{equation*}\n  |\n\\end{equation*}',  'Unnumbered equation'],
    ['align',          '\\begin{align}\n  | &= \\\\\n\\end{align}',  'Aligned equations'],
    ['align*',         '\\begin{align*}\n  | &= \\\\\n\\end{align*}','Unnumbered align'],
    ['gather',         '\\begin{gather}\n  |\n\\end{gather}',         'Gathered equations'],
    ['itemize',        '\\begin{itemize}\n  \\item |\n\\end{itemize}','Bullet list'],
    ['enumerate',      '\\begin{enumerate}\n  \\item |\n\\end{enumerate}','Numbered list'],
    ['description',    '\\begin{description}\n  \\item[|] \n\\end{description}','Description list'],
    ['figure',         '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{|}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}','Figure'],
    ['table',          '\\begin{table}[htbp]\n  \\centering\n  \\caption{|}\n  \\label{tab:}\n  \\begin{tabular}{cc}\n    \\hline\n     & \\\\\n    \\hline\n  \\end{tabular}\n\\end{table}','Table'],
    ['tabular',        '\\begin{tabular}{|cc}\n  \\hline\n   & \\\\\n  \\hline\n\\end{tabular}','Tabular'],
    ['matrix',         '\\begin{matrix}\n  | & \\\\\n   & \n\\end{matrix}','Matrix'],
    ['pmatrix',        '\\begin{pmatrix}\n  | & \\\\\n   & \n\\end{pmatrix}','Parentheses matrix'],
    ['bmatrix',        '\\begin{bmatrix}\n  | & \\\\\n   & \n\\end{bmatrix}','Bracket matrix'],
    ['vmatrix',        '\\begin{vmatrix}\n  | & \\\\\n   & \n\\end{vmatrix}','Determinant matrix'],
    ['theorem',        '\\begin{theorem}\n  |\n\\end{theorem}',       'Theorem'],
    ['lemma',          '\\begin{lemma}\n  |\n\\end{lemma}',           'Lemma'],
    ['proof',          '\\begin{proof}\n  |\n\\end{proof}',           'Proof'],
    ['corollary',      '\\begin{corollary}\n  |\n\\end{corollary}',   'Corollary'],
    ['definition',     '\\begin{definition}\n  |\n\\end{definition}', 'Definition'],
    ['remark',         '\\begin{remark}\n  |\n\\end{remark}',         'Remark'],
    ['example',        '\\begin{example}\n  |\n\\end{example}',       'Example'],
    ['abstract',       '\\begin{abstract}\n  |\n\\end{abstract}',     'Abstract'],
    ['verbatim',       '\\begin{verbatim}\n|\n\\end{verbatim}',       'Verbatim text'],
    ['lstlisting',     '\\begin{lstlisting}[language=|]\n\n\\end{lstlisting}','Code listing'],
    ['minipage',       '\\begin{minipage}{|0.5\\linewidth}\n\n\\end{minipage}','Minipage'],
    ['multicols',      '\\begin{multicols}{|2}\n\n\\end{multicols}',  'Multi-column'],
    ['tikzpicture',    '\\begin{tikzpicture}\n  |\n\\end{tikzpicture}','TikZ picture'],
    // ── References / cross-refs ──────────────────────────────────────────────
    ['label',          '\\label{|}',                       'Label for cross-ref'],
    ['ref',            '\\ref{|}',                         'Cross-reference'],
    ['eqref',          '\\eqref{|}',                       'Equation reference'],
    ['pageref',        '\\pageref{|}',                     'Page reference'],
    ['cite',           '\\cite{|}',                        'Citation'],
    ['citet',          '\\citet{|}',                       'Textual citation'],
    ['citep',          '\\citep{|}',                       'Parenthetical citation'],
    ['citeauthor',     '\\citeauthor{|}',                  'Cite author only'],
    ['citeyear',       '\\citeyear{|}',                    'Cite year only'],
    ['bibitem',        '\\bibitem{|}',                     'Bibliography item'],
    ['url',            '\\url{|}',                         'URL link'],
    ['href',           '\\href{|}{text}',                  'Hyperlink'],
    ['hyperref',       '\\hyperref[|]{text}',              'Internal hyperlink'],
    // ── Graphics / floats ────────────────────────────────────────────────────
    ['includegraphics','\\includegraphics[width=|\\linewidth]{}','Include image'],
    ['caption',        '\\caption{|}',                     'Float caption'],
    ['subcaption',     '\\subcaption{|}',                  'Subcaption'],
    ['centering',      '\\centering',                      'Center content'],
    ['hline',          '\\hline',                          'Horizontal table rule'],
    ['toprule',        '\\toprule',                        'Booktabs top rule'],
    ['midrule',        '\\midrule',                        'Booktabs mid rule'],
    ['bottomrule',     '\\bottomrule',                     'Booktabs bottom rule'],
    // ── Spacing ──────────────────────────────────────────────────────────────
    ['vspace',         '\\vspace{|}',                      'Vertical space'],
    ['hspace',         '\\hspace{|}',                      'Horizontal space'],
    ['vskip',          '\\vskip |pt',                      'TeX vertical skip'],
    ['hskip',          '\\hskip |pt',                      'TeX horizontal skip'],
    ['newline',        '\\newline',                        'Force new line'],
    ['newpage',        '\\newpage',                        'Force new page'],
    ['clearpage',      '\\clearpage',                      'Clear page + floats'],
    ['pagebreak',      '\\pagebreak',                      'Page break hint'],
    ['noindent',       '\\noindent',                       'Suppress indent'],
    ['indent',         '\\indent',                         'Force indent'],
    ['quad',           '\\quad',                           'Medium math space'],
    ['qquad',          '\\qquad',                          'Large math space'],
    // ── Preamble macros ──────────────────────────────────────────────────────
    ['title',          '\\title{|}',                       'Document title'],
    ['author',         '\\author{|}',                      'Document author'],
    ['date',           '\\date{|}',                        'Document date'],
    ['maketitle',      '\\maketitle',                      'Typeset title'],
    ['tableofcontents','\\tableofcontents',                'Table of contents'],
    ['listoffigures',  '\\listoffigures',                  'List of figures'],
    ['listoftables',   '\\listoftables',                   'List of tables'],
    ['appendix',       '\\appendix',                       'Start appendix'],
    ['makeatother',    '\\makeatother',                    'End at-letter scope'],
    ['makeatletter',   '\\makeatletter',                   'Begin at-letter scope'],
    ['newcommand',     '\\newcommand{\\|}{definition}',    'Define new command'],
    ['renewcommand',   '\\renewcommand{\\|}{definition}',  'Redefine command'],
    ['newenvironment', '\\newenvironment{|}{begin}{end}',  'Define environment'],
    ['setlength',      '\\setlength{\\|}{value}',          'Set length'],
    ['addtolength',    '\\addtolength{\\|}{value}',        'Adjust length'],
    // ── Lists ────────────────────────────────────────────────────────────────
    ['item',           '\\item |',                         'List item'],
    // ── Misc ─────────────────────────────────────────────────────────────────
    ['and',            '\\and',                            'Author separator'],
    ['thanks',         '\\thanks{|}',                      'Acknowledgement footnote'],
    ['LaTeX',          '\\LaTeX',                          'LaTeX logo'],
    ['TeX',            '\\TeX',                            'TeX logo'],
    ['today',          '\\today',                          'Current date'],
    ['par',            '\\par',                            'Paragraph break'],
    ['qed',            '\\qed',                            'QED symbol'],
    ['qquad',          '\\qquad',                          'Large math space'],
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let dropdownEl = null;
  let activeIdx = 0;
  let currentPrefix = '';   // the letters after \ that the user has typed
  let filtered = [];
  let textarea = null;
  let insertStart = 0;      // position of \ in the text

  // ── Dropdown DOM ─────────────────────────────────────────────────────────

  function ensureDropdown() {
    if (dropdownEl) return dropdownEl;
    dropdownEl = D.createElement('div');
    dropdownEl.id = 'latexAutocompleteDropdown';
    dropdownEl.style.cssText = [
      'position:fixed',
      'z-index:99999',
      'background:#fff',
      'border:1px solid #d1d5db',
      'border-radius:8px',
      'box-shadow:0 8px 24px rgba(0,0,0,.18)',
      'max-height:260px',
      'overflow-y:auto',
      'min-width:260px',
      'max-width:420px',
      'font-size:13px',
      'display:none',
      'padding:4px 0'
    ].join(';');
    D.body.appendChild(dropdownEl);
    return dropdownEl;
  }

  function hideDropdown() {
    if (dropdownEl) dropdownEl.style.display = 'none';
    filtered = [];
    currentPrefix = '';
  }

  function renderDropdown(items, selectedIdx) {
    const dd = ensureDropdown();
    if (!items.length) { hideDropdown(); return; }
    dd.innerHTML = '';
    items.forEach(([trigger, snippet, desc], i) => {
      const row = D.createElement('div');
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:5px 12px',
        'cursor:pointer',
        'border-radius:4px',
        'user-select:none',
        i === selectedIdx ? 'background:#eff6ff;' : ''
      ].join(';');
      row.dataset.idx = i;

      const cmd = D.createElement('span');
      cmd.style.cssText = 'font-family:monospace;font-weight:600;color:#1e40af;min-width:110px;';
      cmd.textContent = '\\' + trigger;

      const descEl = D.createElement('span');
      descEl.style.cssText = 'color:#6b7280;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      descEl.textContent = desc;

      row.appendChild(cmd);
      row.appendChild(descEl);

      row.addEventListener('mousedown', (e) => {
        e.preventDefault(); // don't blur the textarea
        insertSnippet(i);
      });

      dd.appendChild(row);
    });
    dd.style.display = 'block';
  }

  function scrollSelectedIntoView() {
    if (!dropdownEl) return;
    const rows = dropdownEl.querySelectorAll('[data-idx]');
    const row = rows[activeIdx];
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  // ── Cursor position (mirror-div technique) ────────────────────────────────

  function getCaretPageCoords(ta, pos) {
    const mirror = D.createElement('div');
    const cs = W.getComputedStyle(ta);
    [
      'font', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
      'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform',
      'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'border', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing', 'whiteSpace', 'wordWrap', 'wordBreak', 'tabSize',
      'overflowX', 'overflowY'
    ].forEach((prop) => {
      try { mirror.style[prop] = cs[prop]; } catch (_) {}
    });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.width = ta.offsetWidth + 'px';
    mirror.style.height = 'auto';
    mirror.style.overflow = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';

    const before = D.createElement('span');
    before.textContent = ta.value.substring(0, pos);
    const caret = D.createElement('span');
    caret.textContent = '|';
    mirror.appendChild(before);
    mirror.appendChild(caret);
    D.body.appendChild(mirror);

    const taRect = ta.getBoundingClientRect();
    const caretRect = caret.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    // Adjust for scroll position inside textarea
    const relTop = caretRect.top - mirrorRect.top - ta.scrollTop;
    const relLeft = caretRect.left - mirrorRect.left - ta.scrollLeft;

    D.body.removeChild(mirror);

    return {
      top: taRect.top + relTop + parseFloat(cs.lineHeight || '18'),
      left: taRect.left + relLeft
    };
  }

  function positionDropdown(ta, caretPos) {
    const coords = getCaretPageCoords(ta, caretPos);
    const dd = ensureDropdown();

    // Clamp to viewport
    const vw = W.innerWidth;
    const vh = W.innerHeight;
    let top = coords.top;
    let left = coords.left;

    // Don't go past right edge
    if (left + 300 > vw) left = Math.max(0, vw - 310);
    // If not enough room below, show above
    const ddHeight = Math.min(260, filtered.length * 32 + 10);
    if (top + ddHeight > vh && top - ddHeight > 0) top = coords.top - ddHeight - parseFloat(W.getComputedStyle(ta).lineHeight || 18) - 4;

    dd.style.top = top + 'px';
    dd.style.left = left + 'px';
  }

  // ── Snippet insertion ─────────────────────────────────────────────────────

  function insertSnippet(itemIdx) {
    if (!textarea) return;
    const item = filtered[itemIdx];
    if (!item) return;

    const [trigger, snippet] = item;
    const cursorMarkerPos = snippet.indexOf('|');
    const text = snippet.replace('|', '');
    const selStart = insertStart + cursorMarkerPos;
    const selEnd = selStart;

    // Replace from \ to current cursor
    const before = textarea.value.slice(0, insertStart);
    const after = textarea.value.slice(textarea.selectionStart);
    const newValue = before + text + after;

    textarea.value = newValue;
    const insertPos = cursorMarkerPos >= 0 ? insertStart + cursorMarkerPos : insertStart + text.length;
    textarea.setSelectionRange(insertPos, insertPos);
    textarea.focus();

    // Notify state
    try { NS.State?.updateActiveText?.(newValue); } catch (_) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_) {}

    hideDropdown();
  }

  // ── Input handler ─────────────────────────────────────────────────────────

  function getPrefix(ta) {
    const pos = ta.selectionStart;
    const text = ta.value;
    // Walk backwards from cursor to find the \ that started this command
    let i = pos - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === '\\') {
        // Found backslash — collect the word after it
        const prefix = text.slice(i + 1, pos);
        // Only activate if prefix is pure letters (no space or brace)
        if (/^[A-Za-z*]*$/.test(prefix)) {
          return { start: i, prefix };
        }
        return null;
      }
      // Stop if we hit whitespace, brace, or another backslash trigger
      if (/[\s{}\[\]$%&~^_#]/.test(ch)) return null;
      i--;
    }
    return null;
  }

  function onInput() {
    const match = getPrefix(textarea);
    if (!match) { hideDropdown(); return; }

    const { start, prefix } = match;
    insertStart = start;
    currentPrefix = prefix;

    const query = prefix.toLowerCase();
    filtered = COMMANDS.filter(([trigger]) => trigger.toLowerCase().startsWith(query));
    // Limit to 12 results to keep it manageable
    filtered = filtered.slice(0, 12);

    if (!filtered.length) { hideDropdown(); return; }
    activeIdx = 0;
    renderDropdown(filtered, activeIdx);
    positionDropdown(textarea, start);
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────

  function onKeydown(e) {
    const dd = dropdownEl;
    if (!dd || dd.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = (activeIdx + 1) % filtered.length;
      renderDropdown(filtered, activeIdx);
      positionDropdown(textarea, insertStart);
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
      renderDropdown(filtered, activeIdx);
      positionDropdown(textarea, insertStart);
      scrollSelectedIntoView();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered.length) {
        e.preventDefault();
        insertSnippet(activeIdx);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideDropdown();
    }
  }

  // ── Close on outside click ────────────────────────────────────────────────

  function onDocumentClick(e) {
    if (dropdownEl && !dropdownEl.contains(e.target) && e.target !== textarea) {
      hideDropdown();
    }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────

  function bind() {
    textarea = D.getElementById('sourceEditor');
    if (!textarea) return false;

    textarea.addEventListener('input', onInput);
    textarea.addEventListener('keydown', onKeydown, true);
    D.addEventListener('click', onDocumentClick, true);
    D.addEventListener('focusin', (e) => {
      if (e.target !== textarea) hideDropdown();
    });

    return true;
  }

  function init() {
    if (!bind()) {
      // Retry if editor not yet in DOM
      setTimeout(bind, 600);
    }
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  NS.LatexAutocompleteService = { STAGE, init, hide: hideDropdown };
})();
