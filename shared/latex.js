// LaTeX renderer — KaTeX-backed with \begin{env}, $...$, text commands, etc.

function _katex(latex, displayMode, el) {
  try {
    if (window.katex) el.innerHTML = katex.renderToString(latex, { displayMode, throwOnError: false });
    else el.textContent = latex;
  } catch { el.textContent = latex; }
}

function _matchBraces(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { if (--depth === 0) return i; }
  }
  return -1;
}

function _matchEnv(text, start) {
  const m = text.slice(start).match(/^\\begin\{(\w+\*?)\}/);
  if (!m) return null;
  const env = m[1];
  let pos = start + m[0].length;
  let opt = null;
  if (text[pos] === '[') {
    const close = text.indexOf(']', pos);
    if (close !== -1) { opt = text.slice(pos + 1, close); pos = close + 1; }
  }
  const endStr = `\\end{${env}}`;
  const endIdx = text.indexOf(endStr, pos);
  if (endIdx === -1) return null;
  return { env, content: text.slice(pos, endIdx), end: endIdx + endStr.length, opt };
}

// Commands that take a single {argument}
function _matchTextCmd(text, i) {
  const m = text.slice(i).match(/^\\(textbf|textit|emph|underline|texttt|textsf|textrm|textsc|textsl|textnormal|textup|textmd|textsuperscript|textsubscript|mbox|hbox|fbox|section|subsection|subsubsection|paragraph|footnote|url)\{/);
  if (!m) return null;
  const braceStart = i + m[0].length - 1;
  const braceEnd   = _matchBraces(text, braceStart);
  if (braceEnd === -1) return null;
  return { cmd: m[1], content: text.slice(braceStart + 1, braceEnd), end: braceEnd + 1 };
}

function _renderEnv(env, content, container, opt) {
  const name = env.replace('*', '');
  const MATH_ENVS = ['equation', 'align', 'eqnarray', 'gather', 'multline', 'flalign', 'alignat'];

  if (MATH_ENVS.includes(name)) {
    const latex = content.replace(/\\label\{[^}]*\}/g, '').trim();
    const el = document.createElement('div');
    el.className = 'math-block';
    _katex(latex, true, el);
    container.appendChild(el);

  } else if (name === 'description') {
    const dl = document.createElement('dl');
    dl.className = 'latex-dl';
    const re = /\\item\[([^\]]*)\]([\s\S]*?)(?=\\item\[|$)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const item = document.createElement('div');
      item.className = 'latex-dl-item';
      const dt = document.createElement('dt');
      dt.className = 'latex-dt';
      _processLatex(m[1], dt);
      const dd = document.createElement('dd');
      dd.className = 'latex-dd';
      _processLatex(m[2].trim(), dd);
      item.appendChild(dt);
      item.appendChild(dd);
      dl.appendChild(item);
    }
    container.appendChild(dl);

  } else if (name === 'itemize' || name === 'enumerate') {
    const list = document.createElement(name === 'enumerate' ? 'ol' : 'ul');
    list.className = 'latex-list';

    if (name === 'enumerate' && opt) {
      const optKey = opt.replace(/[().\s]/g, '');
      if (optKey === 'a')      list.style.listStyleType = 'lower-alpha';
      else if (optKey === 'A') list.style.listStyleType = 'upper-alpha';
      else if (optKey === 'i') list.style.listStyleType = 'lower-roman';
      else if (optKey === 'I') list.style.listStyleType = 'upper-roman';
    }

    const re = /\\item(?:\[([^\]]*)\])?([\s\S]*?)(?=\\item|$)/g;
    let m;
    const items = [];
    while ((m = re.exec(content)) !== null) {
      const itemText = m[2].trim();
      if (!itemText && m[1] == null) continue;
      items.push({ label: m[1] ?? null, text: itemText });
    }

    const hasCustomLabels = items.some(it => it.label !== null);
    if (hasCustomLabels) {
      list.style.listStyle  = 'none';
      list.style.paddingLeft = '0';
    }

    items.forEach(({ label, text: itemText }) => {
      const li = document.createElement('li');
      if (label !== null) {
        li.className = 'latex-list-item-labeled';
        const labelEl = document.createElement('span');
        labelEl.className = 'latex-item-label';
        _processLatex(label, labelEl);
        li.appendChild(labelEl);
        const contentEl = document.createElement('span');
        _processLatex(itemText, contentEl);
        li.appendChild(contentEl);
      } else {
        _processLatex(itemText, li);
      }
      list.appendChild(li);
    });
    container.appendChild(list);

  } else {
    const el = document.createElement('div');
    el.className = 'math-block';
    _katex(`\\begin{${env}}${content}\\end{${env}}`, true, el);
    container.appendChild(el);
  }
}

// No-argument commands that output a single character or string
const _CHAR_CMDS = {
  // Ellipsis
  ldots: '…', dots: '…', cdots: '⋯', textellipsis: '…',
  // Dashes
  textendash: '–', textemdash: '—',
  // Quotes
  textquoteleft: '‘', textquoteright: '’', lq: '‘', rq: '’',
  textquotedblleft: '“', textquotedblright: '”',
  // Special text symbols
  textbackslash: '\\', textbar: '|', textless: '<', textgreater: '>',
  textasciitilde: '~', textasciicircum: '^',
  textbullet: '•', textperiodcentered: '·',
  textregistered: '®', texttrademark: '™', textcopyright: '©',
  textdegree: '°', textcelsius: '℃',
  textmu: 'µ', textohm: 'Ω',
  textparagraph: '¶', textsection: '§',
  // Symbols
  dag: '†', ddag: '‡', S: '§', P: '¶',
  copyright: '©', registered: '®',
  pounds: '£', textsterling: '£', yen: '¥', euro: '€',
  // Non-ASCII letters
  AE: 'Æ', ae: 'æ', OE: 'Œ', oe: 'œ',
  AA: 'Å', aa: 'å', O: 'Ø', o: 'ø', ss: 'ß',
  i: 'ı', j: 'ȷ', l: 'ł', L: 'Ł',
  // Degree / angle
  circ: '°',
};

// Commands that are silently consumed (no output, no argument)
const _NOOP_CMDS = new Set([
  'tiny', 'scriptsize', 'footnotesize', 'small', 'normalsize',
  'large', 'Large', 'LARGE', 'huge', 'Huge',
  'normalfont', 'rmfamily', 'sffamily', 'ttfamily',
  'bfseries', 'mdseries', 'itshape', 'slshape', 'upshape', 'scshape',
  'centering', 'raggedright', 'raggedleft',
  'protect', 'relax', 'allowbreak', 'linewidth', 'textwidth',
  'boldmath', 'unboldmath',
]);

function _processLatex(text, container) {
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) { container.appendChild(document.createTextNode(buf)); buf = ''; }
  };

  while (i < text.length) {

    // \begin{env}...\end{env}
    if (text.startsWith('\\begin{', i)) {
      const env = _matchEnv(text, i);
      if (env) { flush(); _renderEnv(env.env, env.content, container, env.opt); i = env.end; continue; }
    }

    // $$...$$ display math
    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

    // \[...\] display math
    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

    // $...$ inline math
    if (text[i] === '$' && text[i + 1] !== '$') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$') break;
        j++;
      }
      if (j < text.length && j > i + 1) {
        flush();
        const inner = text.slice(i + 1, j);
        if (inner.includes('&') || inner.includes('\\\\')) {
          const el = document.createElement('div'); el.className = 'math-block';
          _katex(`\\begin{aligned}${inner}\\end{aligned}`, true, el);
          container.appendChild(el);
        } else {
          const el = document.createElement('span'); el.className = 'math-inline';
          _katex(inner, false, el);
          container.appendChild(el);
        }
        i = j + 1; continue;
      }
    }

    // \textcolor{color}{text}
    const colorM = text.slice(i).match(/^\\textcolor\{([^}]*)\}\{/);
    if (colorM) {
      const braceStart = i + colorM[0].length - 1;
      const braceEnd = _matchBraces(text, braceStart);
      if (braceEnd !== -1) {
        flush();
        const el = document.createElement('span');
        el.style.color = colorM[1];
        _processLatex(text.slice(braceStart + 1, braceEnd), el);
        container.appendChild(el);
        i = braceEnd + 1; continue;
      }
    }

    // \colorbox{color}{text}
    const cboxM = text.slice(i).match(/^\\colorbox\{([^}]*)\}\{/);
    if (cboxM) {
      const braceStart = i + cboxM[0].length - 1;
      const braceEnd = _matchBraces(text, braceStart);
      if (braceEnd !== -1) {
        flush();
        const el = document.createElement('span');
        el.style.backgroundColor = cboxM[1];
        el.style.padding = '0 2px';
        el.style.borderRadius = '2px';
        _processLatex(text.slice(braceStart + 1, braceEnd), el);
        container.appendChild(el);
        i = braceEnd + 1; continue;
      }
    }

    // Text commands with {argument}: \textbf, \textit, \textsuperscript, \section, etc.
    const cmd = _matchTextCmd(text, i);
    if (cmd) {
      flush();
      let el;
      if (cmd.cmd === 'textsuperscript') {
        el = document.createElement('sup');
      } else if (cmd.cmd === 'textsubscript') {
        el = document.createElement('sub');
      } else if (cmd.cmd === 'section') {
        el = document.createElement('h2'); el.className = 'latex-section';
      } else if (cmd.cmd === 'subsection') {
        el = document.createElement('h3'); el.className = 'latex-subsection';
      } else if (cmd.cmd === 'subsubsection') {
        el = document.createElement('h4'); el.className = 'latex-subsubsection';
      } else if (cmd.cmd === 'paragraph') {
        el = document.createElement('p'); el.className = 'latex-paragraph'; el.style.fontWeight = '600';
      } else if (cmd.cmd === 'footnote') {
        // Render as a small inline note in parentheses
        const sup = document.createElement('sup');
        sup.textContent = '*';
        container.appendChild(sup);
        const note = document.createElement('span');
        note.className = 'latex-footnote';
        _processLatex(cmd.content, note);
        container.appendChild(note);
        i = cmd.end; continue;
      } else if (cmd.cmd === 'url') {
        el = document.createElement('a');
        el.href = cmd.content; el.target = '_blank'; el.rel = 'noopener noreferrer';
        el.className = 'latex-url'; el.textContent = cmd.content;
        container.appendChild(el); i = cmd.end; continue;
      } else {
        el = document.createElement('span');
        if      (cmd.cmd === 'textbf')                             el.style.fontWeight = '700';
        else if (cmd.cmd === 'textit' || cmd.cmd === 'emph')       el.style.fontStyle  = 'italic';
        else if (cmd.cmd === 'underline')                          el.style.textDecoration = 'underline';
        else if (cmd.cmd === 'texttt')                             el.style.fontFamily = 'monospace';
        else if (cmd.cmd === 'textsf')                             el.style.fontFamily = 'sans-serif';
        else if (cmd.cmd === 'textsc')                             el.style.fontVariant = 'small-caps';
        else if (cmd.cmd === 'textsl')                             el.style.fontStyle  = 'oblique';
        else if (cmd.cmd === 'fbox') {
          el.style.border = '1px solid currentColor';
          el.style.padding = '1px 4px';
          el.style.borderRadius = '2px';
          el.style.display = 'inline-block';
        }
        // mbox, hbox, textnormal, textup, textmd, textrm: render content as-is
      }
      _processLatex(cmd.content, el);
      container.appendChild(el);
      i = cmd.end; continue;
    }

    // Strip commands (swallow, no output)
    const stripM = text.slice(i).match(/^\\(?:label|ref|nonumber|pageref|index|glossary|hyphenation|bibliographystyle|bibliography)\{[^}]*\}|^\\(?:begin|end)\{document\}/);
    if (stripM) { i += stripM[0].length; continue; }

    // \eqref{key} → "(key)"
    const eqM = text.slice(i).match(/^\\eqref\{([^}]*)\}/);
    if (eqM) { flush(); container.appendChild(document.createTextNode(`(${eqM[1]})`)); i += eqM[0].length; continue; }

    // \cite[note]{key} → "[key]"
    const citeM = text.slice(i).match(/^\\cite(?:\[[^\]]*\])?\{([^}]*)\}/);
    if (citeM) { flush(); container.appendChild(document.createTextNode(`[${citeM[1]}]`)); i += citeM[0].length; continue; }

    // \hfill → flex spacer
    if (text.startsWith('\\hfill', i)) {
      flush();
      const sp = document.createElement('span'); sp.className = 'latex-hfill';
      container.appendChild(sp); i += 6; continue;
    }

    // Horizontal spacing (longest first to avoid prefix conflicts)
    if (text.startsWith('\\qquad', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '2em';
      container.appendChild(sp); i += 6; continue;
    }
    if (text.startsWith('\\quad', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '1em';
      container.appendChild(sp); i += 5; continue;
    }
    if (text.startsWith('\\enspace', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '0.5em';
      container.appendChild(sp); i += 8; continue;
    }
    if (text.startsWith('\\thinspace', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '0.167em';
      container.appendChild(sp); i += 10; continue;
    }
    if (text.startsWith('\\negthinspace', i)) { i += 13; continue; }
    if (text.startsWith('\\negmedspace', i))  { i += 12; continue; }
    if (text.startsWith('\\negthickspace', i)) { i += 14; continue; }

    // \hspace{len} or \hspace*{len}
    const hspaceM = text.slice(i).match(/^\\hspace\*?\{([^}]*)\}/);
    if (hspaceM) {
      flush();
      const sp = document.createElement('span');
      sp.style.display = 'inline-block';
      const len = hspaceM[1].trim();
      sp.style.width = /^[\d.]+(?:em|ex|pt|cm|mm|in|px|rem)$/.test(len) ? len : '1em';
      container.appendChild(sp); i += hspaceM[0].length; continue;
    }

    // Vertical spacing / page breaks
    const skipM = text.slice(i).match(/^\\(?:smallskip|medskip|bigskip|par|vspace\*?\{[^}]*\}|vfill)/);
    if (skipM) { flush(); container.appendChild(document.createElement('br')); i += skipM[0].length; continue; }

    const pageM = text.slice(i).match(/^\\(?:newpage|clearpage|cleardoublepage)/);
    if (pageM) { flush(); container.appendChild(document.createElement('hr')); i += pageM[0].length; continue; }

    // \noindent, \linebreak → consume / br
    if (text.startsWith('\\noindent', i))  { i += 9;  continue; }
    if (text.startsWith('\\linebreak', i)) { flush(); container.appendChild(document.createElement('br')); i += 10; continue; }

    // \\ and \newline → <br>
    if (text.startsWith('\\\\', i))      { flush(); container.appendChild(document.createElement('br')); i += 2; continue; }
    if (text.startsWith('\\newline', i)) { flush(); container.appendChild(document.createElement('br')); i += 8; continue; }

    // Backslash-escaped reserved characters: \% \$ \& \# \_ \{ \}
    if (text[i] === '\\' && i + 1 < text.length) {
      const ESCAPED = { '%': '%', '$': '$', '&': '&', '#': '#', '_': '_', '{': '{', '}': '}' };
      if (ESCAPED[text[i + 1]] !== undefined) {
        flush(); buf += ESCAPED[text[i + 1]]; i += 2; continue;
      }
    }

    // Single-char math spacing (must check before generic \cmd handler)
    if (text.startsWith('\\,', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '0.167em';
      container.appendChild(sp); i += 2; continue;
    }
    if (text.startsWith('\\;', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '0.278em';
      container.appendChild(sp); i += 2; continue;
    }
    if (text.startsWith('\\:', i)) {
      flush();
      const sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.width = '0.222em';
      container.appendChild(sp); i += 2; continue;
    }
    if (text.startsWith('\\!', i)) { i += 2; continue; } // negative thin space → skip

    // \  (backslash + space) → forced space
    if (text[i] === '\\' && text[i + 1] === ' ') { flush(); buf += ' '; i += 2; continue; }

    // \LaTeX and \TeX → styled output
    if (text.startsWith('\\LaTeX', i)) {
      flush();
      const el = document.createElement('span');
      el.innerHTML = 'L<sup style="font-size:.75em;vertical-align:.25em;margin-left:-.1em">A</sup>'
                   + '<span style="letter-spacing:-.1em">T</span>'
                   + '<sub style="font-size:.75em;vertical-align:-.2em">E</sub>X';
      container.appendChild(el); i += 6; continue;
    }
    if (text.startsWith('\\TeX', i)) {
      flush();
      const el = document.createElement('span');
      el.innerHTML = 'T<sub style="font-size:.75em;vertical-align:-.2em">E</sub>X';
      container.appendChild(el); i += 4; continue;
    }

    // Generic no-arg \cmdname lookup
    if (text[i] === '\\' && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
      const m = text.slice(i + 1).match(/^([a-zA-Z]+)/);
      if (m) {
        const cmdName = m[1];
        if (_CHAR_CMDS[cmdName] !== undefined) {
          flush();
          buf += _CHAR_CMDS[cmdName];
          i += 1 + cmdName.length;
          if (text[i] === '{' && text[i + 1] === '}') i += 2; // consume optional {}
          else if (text[i] === ' ') i++;                        // consume trailing space
          continue;
        }
        if (_NOOP_CMDS.has(cmdName)) {
          i += 1 + cmdName.length;
          if (text[i] === '{' && text[i + 1] === '}') i += 2;
          else if (text[i] === ' ') i++;
          continue;
        }
      }
    }

    // Typographic dashes: --- → em dash, -- → en dash (must check --- before --)
    if (text.startsWith('---', i)) { flush(); buf += '—'; i += 3; continue; }
    if (text.startsWith('--',  i)) { flush(); buf += '–'; i += 2; continue; }

    // ~ → non-breaking space (LaTeX text-mode tie)
    if (text[i] === '~') { flush(); buf += ' '; i++; continue; }

    buf += text[i++];
  }
  flush();
}

export function renderLatexText(text, container) {
  container.innerHTML = '';
  if (!text) return;
  _processLatex(text, container);
}

export function renderMathBlock(latex, displayMode = true) {
  if (!latex || !window.katex) return null;
  const el = document.createElement(displayMode ? 'div' : 'span');
  el.className = displayMode ? 'math-block' : 'math-inline';
  try { el.innerHTML = katex.renderToString(latex, { displayMode, throwOnError: false }); }
  catch { el.textContent = latex; }
  return el;
}
