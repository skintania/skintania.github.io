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

function _matchTextCmd(text, i) {
  const m = text.slice(i).match(/^\\(textbf|textit|emph|underline|texttt|textsf|textrm)\{/);
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

function _processLatex(text, container) {
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) { container.appendChild(document.createTextNode(buf)); buf = ''; }
  };

  while (i < text.length) {

    if (text.startsWith('\\begin{', i)) {
      const env = _matchEnv(text, i);
      if (env) { flush(); _renderEnv(env.env, env.content, container, env.opt); i = env.end; continue; }
    }

    if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

    if (text.startsWith('\\[', i)) {
      const end = text.indexOf('\\]', i + 2);
      if (end !== -1) {
        flush();
        const el = document.createElement('div'); el.className = 'math-block';
        _katex(text.slice(i + 2, end), true, el);
        container.appendChild(el); i = end + 2; continue;
      }
    }

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

    const cmd = _matchTextCmd(text, i);
    if (cmd) {
      flush();
      const el = document.createElement('span');
      if (cmd.cmd === 'textbf')                              el.style.fontWeight = '600';
      else if (cmd.cmd === 'textit' || cmd.cmd === 'emph')   el.style.fontStyle = 'italic';
      else if (cmd.cmd === 'underline')                      el.style.textDecoration = 'underline';
      else if (cmd.cmd === 'texttt')                         el.style.fontFamily = 'monospace';
      _processLatex(cmd.content, el);
      container.appendChild(el); i = cmd.end; continue;
    }

    const stripM = text.slice(i).match(/^\\(?:label|ref|nonumber)\{[^}]*\}|^\\(?:begin|end)\{document\}/);
    if (stripM) { i += stripM[0].length; continue; }

    const eqM = text.slice(i).match(/^\\eqref\{([^}]*)\}/);
    if (eqM) { flush(); container.appendChild(document.createTextNode(`(${eqM[1]})`)); i += eqM[0].length; continue; }

    if (text.startsWith('\\hfill', i)) {
      flush();
      const sp = document.createElement('span'); sp.className = 'latex-hfill';
      container.appendChild(sp); i += 6; continue;
    }

    const skipM = text.slice(i).match(/^\\(?:smallskip|medskip|bigskip|par|vspace\{[^}]*\})/);
    if (skipM) { flush(); container.appendChild(document.createElement('br')); i += skipM[0].length; continue; }

    if (text.startsWith('\\noindent', i)) { i += 9; continue; }

    if (text.startsWith('\\\\', i)) { flush(); container.appendChild(document.createElement('br')); i += 2; continue; }
    if (text.startsWith('\\newline', i)) { flush(); container.appendChild(document.createElement('br')); i += 8; continue; }

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
