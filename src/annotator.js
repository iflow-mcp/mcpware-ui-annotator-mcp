// Client-side annotation script — injected into proxied pages
// Uses HTTP polling to communicate with MCP server (no WebSocket = more stable)

export function getAnnotatorScript(serverPort) {
  return `
<script data-ui-annotator>
(function() {
  if (window.__uiAnnotator) return;
  window.__uiAnnotator = true;

  const SERVER = 'http://localhost:${serverPort}';
  let elements = [];
  let inspectMode = false;
  let hoveredInfo = null; // currently hovered element info

  // ─── Send elements to server via POST ───
  function sendElements() {
    try {
      fetch(SERVER + '/__annotator/elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(elements),
      }).catch(() => {});
    } catch(e) {}
  }

  // ─── Poll for commands from server ───
  function pollCommands() {
    fetch(SERVER + '/__annotator/commands')
      .then(r => r.json())
      .then(cmds => {
        for (const cmd of cmds) {
          if (cmd.type === 'highlight') highlightByName(cmd.name);
          if (cmd.type === 'scan') { scanElements(); sendElements(); }
          if (cmd.type === 'inspect_on') setInspectMode(true);
          if (cmd.type === 'inspect_off') setInspectMode(false);
        }
      })
      .catch(() => {})
      .finally(() => setTimeout(pollCommands, 1000));
  }

  // ─── Element scanning ───
  function scanElements() {
    elements = [];
    const seen = new Set();

    // Semantic elements
    document.querySelectorAll('[role], [aria-label], nav, header, footer, main, aside, section, article, form').forEach(el => {
      if (el.closest('[data-ui-annotator]')) return;
      const name = el.getAttribute('aria-label') || el.getAttribute('role') || el.tagName.toLowerCase();
      addElement(el, name, 'semantic', seen);
    });

    // Elements with id or class
    document.querySelectorAll('[id], [class]').forEach(el => {
      if (el.closest('[data-ui-annotator]')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) return;

      const id = el.id;
      const cls = el.className && typeof el.className === 'string'
        ? el.className.split(/\\s+/).filter(c => c && !c.startsWith('__')).slice(0, 3).join('.')
        : '';
      const name = id || cls || null;
      if (name) addElement(el, name, id ? 'id' : 'class', seen);
    });

    // Interactive elements
    document.querySelectorAll('button, a[href], input, select, textarea').forEach(el => {
      if (el.closest('[data-ui-annotator]')) return;
      const text = (el.textContent || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').trim().slice(0, 40);
      if (text) addElement(el, text, el.tagName.toLowerCase(), seen);
    });
  }

  function addElement(el, name, source, seen) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5) return;
    const key = name + '|' + Math.round(rect.left) + '|' + Math.round(rect.top);
    if (seen.has(key)) return;
    seen.add(key);

    elements.push({
      name: name,
      source: source,
      tag: el.tagName.toLowerCase(),
      selector: getSelector(el),
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      text: (el.textContent || '').trim().slice(0, 80),
      childCount: el.children.length
    });
  }

  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    return el.tagName.toLowerCase() + cls;
  }

  // ─── Toolbar ───
  let collapsed = false;

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-ui-annotator', '1');
  toolbar.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;align-items:center;background:#1a1a2e;border-radius:0 0 10px 10px;padding:6px 12px 5px;box-shadow:0 4px 20px rgba(0,0,0,.4);font:600 12px/1 system-ui,sans-serif;color:#fff;user-select:none;border:1px solid rgba(255,255,255,.1);border-top:none;transition:all .2s ease-out;';

  // Top row: button + count + collapse
  const topRow = document.createElement('div');
  topRow.setAttribute('data-ui-annotator', '1');
  topRow.style.cssText = 'display:flex;align-items:center;gap:2px;width:100%;';

  // Inspect button
  const inspectBtn = document.createElement('button');
  inspectBtn.setAttribute('data-ui-annotator', '1');
  inspectBtn.innerHTML = '<span style="font-size:14px;vertical-align:middle">&#128269;</span> Inspect';
  inspectBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,.15);color:#94a3b8;font:600 11px/1 system-ui,sans-serif;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px;';
  inspectBtn.onmouseenter = () => { if (!inspectMode) inspectBtn.style.background = 'rgba(255,255,255,.08)'; };
  inspectBtn.onmouseleave = () => { if (!inspectMode) inspectBtn.style.background = 'transparent'; };
  inspectBtn.onclick = (e) => { e.stopPropagation(); setInspectMode(!inspectMode); };
  topRow.appendChild(inspectBtn);

  // Separator
  const sep = document.createElement('div');
  sep.setAttribute('data-ui-annotator', '1');
  sep.style.cssText = 'width:1px;height:16px;background:rgba(255,255,255,.15);margin:0 4px;';
  topRow.appendChild(sep);

  // Element count
  const countLabel = document.createElement('span');
  countLabel.setAttribute('data-ui-annotator', '1');
  countLabel.style.cssText = 'color:#c8cdd5;font-size:12px;padding:0 4px;flex:1;';
  countLabel.textContent = '0 elements';
  topRow.appendChild(countLabel);

  // Collapse button
  const collapseBtn = document.createElement('button');
  collapseBtn.setAttribute('data-ui-annotator', '1');
  collapseBtn.innerHTML = '&#9650;'; // ▲
  collapseBtn.title = 'Collapse toolbar';
  collapseBtn.style.cssText = 'background:transparent;border:none;color:#c8cdd5;font-size:12px;cursor:pointer;padding:2px 4px;line-height:1;transition:all .15s;';
  collapseBtn.onmouseenter = () => { collapseBtn.style.color = '#fff'; };
  collapseBtn.onmouseleave = () => { collapseBtn.style.color = '#c8cdd5'; };
  collapseBtn.onclick = (e) => { e.stopPropagation(); toggleCollapse(); };
  topRow.appendChild(collapseBtn);

  toolbar.appendChild(topRow);

  // Subtitle hint
  const subtitle = document.createElement('div');
  subtitle.setAttribute('data-ui-annotator', '1');
  subtitle.style.cssText = 'color:#c8cdd5;font-size:11px;font-weight:400;margin-top:3px;text-align:center;transition:all .15s;overflow:hidden;';
  subtitle.textContent = 'Enable to click any element and copy its name';
  toolbar.appendChild(subtitle);

  document.body.appendChild(toolbar);

  // Collapsed pill — shown when toolbar is collapsed
  const pill = document.createElement('div');
  pill.setAttribute('data-ui-annotator', '1');
  pill.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:100000;background:#1a1a2e;border-radius:0 0 8px 8px;padding:4px 14px;box-shadow:0 2px 10px rgba(0,0,0,.3);font:600 11px/1 system-ui,sans-serif;color:#c8cdd5;cursor:pointer;user-select:none;border:1px solid rgba(255,255,255,.1);border-top:none;display:none;transition:all .15s;';
  pill.innerHTML = '&#128269; UI Annotator &#9660;'; // 🔍 UI Annotator ▼
  pill.onmouseenter = () => { pill.style.color = '#fff'; };
  pill.onmouseleave = () => { pill.style.color = '#c8cdd5'; };
  pill.onclick = () => { toggleCollapse(); };
  document.body.appendChild(pill);

  function toggleCollapse() {
    collapsed = !collapsed;
    if (collapsed) {
      toolbar.style.display = 'none';
      pill.style.display = 'block';
    } else {
      toolbar.style.display = 'flex';
      pill.style.display = 'none';
    }
  }

  // Update element count periodically
  setInterval(() => { countLabel.textContent = elements.length + ' elements'; }, 2000);

  // ─── Inspect mode toggle ───
  function setInspectMode(on) {
    inspectMode = on;
    if (on) {
      inspectBtn.style.background = '#e11d48';
      inspectBtn.style.color = '#fff';
      inspectBtn.style.borderColor = '#e11d48';
      inspectBtn.innerHTML = '<span style="font-size:14px;vertical-align:middle">&#128269;</span> Inspect ON';
      document.body.style.cursor = 'crosshair';
      overlay.style.borderColor = '#e11d48';
      subtitle.textContent = 'Click any element to copy its name to clipboard';
      subtitle.style.color = '#059669';
    } else {
      inspectBtn.style.background = 'transparent';
      inspectBtn.style.color = '#94a3b8';
      inspectBtn.style.borderColor = 'rgba(255,255,255,.15)';
      inspectBtn.innerHTML = '<span style="font-size:14px;vertical-align:middle">&#128269;</span> Inspect';
      document.body.style.cursor = '';
      overlay.style.borderColor = '#e11d48';
      subtitle.textContent = 'Enable to click any element and copy its name';
      subtitle.style.color = '#c8cdd5';
    }
  }

  // ─── Copied toast ───
  function showCopied(name) {
    const toast = document.createElement('div');
    toast.setAttribute('data-ui-annotator', '1');
    toast.textContent = 'Copied: ' + name;
    toast.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);z-index:100001;background:#059669;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 14px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 1200);
    setTimeout(() => toast.remove(), 1500);
  }

  // ─── Hover UI ───
  const overlay = document.createElement('div');
  overlay.setAttribute('data-ui-annotator', '1');
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2.5px solid #e11d48;display:none;box-shadow:0 0 0 4px rgba(225,29,72,0.18);transition:all .12s ease-out;';
  document.body.appendChild(overlay);

  const tip = document.createElement('div');
  tip.setAttribute('data-ui-annotator', '1');
  tip.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;background:#1a1a2e;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 12px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.35);display:none;max-width:340px;border:1px solid rgba(225,29,72,.4);';
  document.body.appendChild(tip);

  let curEl = null;

  function findElementInfo(el) {
    let target = el;
    while (target && target !== document.body) {
      if (target.hasAttribute('data-ui-annotator')) { target = target.parentElement; continue; }
      const rect = target.getBoundingClientRect();
      const match = elements.find(e =>
        Math.abs(e.rect.x - Math.round(rect.left)) < 3 &&
        Math.abs(e.rect.y - Math.round(rect.top)) < 3 &&
        Math.abs(e.rect.w - Math.round(rect.width)) < 3
      );
      if (match) return { el: target, info: match };
      target = target.parentElement;
    }
    return null;
  }

  document.addEventListener('mousemove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('[data-ui-annotator]')) return;

    const result = findElementInfo(el);
    if (!result) { overlay.style.display = 'none'; tip.style.display = 'none'; curEl = null; hoveredInfo = null; return; }
    if (result.el === curEl) return;
    curEl = result.el;
    hoveredInfo = result.info;

    const rect = result.el.getBoundingClientRect();
    const br = getComputedStyle(result.el).borderRadius || '0';
    overlay.style.display = 'block';
    overlay.style.left = (rect.left - 3) + 'px';
    overlay.style.top = (rect.top - 3) + 'px';
    overlay.style.width = (rect.width + 6) + 'px';
    overlay.style.height = (rect.height + 6) + 'px';
    overlay.style.borderRadius = br;

    const info = result.info;
    const inspectHint = inspectMode ? '<div style="color:#059669;font-size:10px;margin-top:3px">Click to copy name</div>' : '';
    tip.innerHTML =
      '<div style="color:#f472b6;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">' + escHtml(info.name) + '</div>' +
      '<div style="color:#94a3b8;font-size:11px;font-family:monospace">' + escHtml(info.selector) + '</div>' +
      (info.text && info.text !== info.name ? '<div style="color:#888;font-size:11px;margin-top:3px;max-height:40px;overflow:hidden">' + escHtml(info.text.slice(0, 60)) + '</div>' : '') +
      '<div style="color:#c8cdd5;font-size:11px;margin-top:3px">' + info.rect.w + ' \\u00d7 ' + info.rect.h + 'px</div>' +
      inspectHint;
    // Make tip visible but offscreen first so we can measure it
    tip.style.display = 'block';
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';

    // Now measure actual tip dimensions
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 10;

    // Horizontal: prefer right of element, fallback left, fallback clamp
    let tx;
    if (rect.right + gap + tw <= vw) {
      tx = rect.right + gap;                     // right of element
    } else if (rect.left - gap - tw >= 0) {
      tx = rect.left - gap - tw;                 // left of element
    } else {
      tx = Math.max(8, Math.min(vw - tw - 8, 8)); // clamp to viewport
    }

    // Vertical: align to element top, but clamp within viewport
    let ty = rect.top;
    if (ty + th > vh - 8) ty = vh - th - 8;      // don't go below viewport
    if (ty < 8) ty = 8;                           // don't go above viewport

    // If element is very tall (bigger than viewport), just stick to top
    if (rect.top < 0 && rect.bottom > vh) ty = 8;

    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
  }, true);

  document.addEventListener('mouseleave', () => {
    overlay.style.display = 'none';
    tip.style.display = 'none';
    curEl = null;
    hoveredInfo = null;
  });

  // ─── Inspect mode: click to copy ───
  document.addEventListener('click', (e) => {
    if (!inspectMode) return;
    if (e.target.closest('[data-ui-annotator]')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (hoveredInfo) {
      navigator.clipboard.writeText(hoveredInfo.name).then(() => {
        showCopied(hoveredInfo.name);
      }).catch(() => {
        // Fallback for non-HTTPS
        const ta = document.createElement('textarea');
        ta.value = hoveredInfo.name;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showCopied(hoveredInfo.name);
      });
    }
  }, true); // capture phase — intercept before page handlers

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Highlight (called from server command) ───
  function highlightByName(name) {
    const match = elements.find(e => e.name === name || e.selector === name);
    if (!match) return;
    const el = document.querySelector(match.selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const flash = document.createElement('div');
    flash.setAttribute('data-ui-annotator', '1');
    flash.style.cssText = 'position:fixed;border:3px solid #e11d48;background:rgba(225,29,72,0.1);z-index:99997;pointer-events:none;border-radius:' + (getComputedStyle(el).borderRadius || '0') + ';transition:opacity .5s;';
    flash.style.left = (rect.left - 4) + 'px';
    flash.style.top = (rect.top - 4) + 'px';
    flash.style.width = (rect.width + 8) + 'px';
    flash.style.height = (rect.height + 8) + 'px';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 1500);
    setTimeout(() => flash.remove(), 2000);
  }

  // ─── Auto-rescan on DOM changes ───
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanElements(); sendElements(); }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Init
  scanElements();
  sendElements();
  pollCommands();

  // Rescan on resize
  window.addEventListener('resize', () => { scanElements(); sendElements(); });
})();
</script>`;
}
