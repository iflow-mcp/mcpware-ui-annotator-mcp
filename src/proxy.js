// Reverse proxy that injects the annotator script into HTML pages
// Zero external dependencies — uses Node.js built-in http module
// Communication: HTTP POST (elements → server) + polling (commands ← server)

import http from 'node:http';
import { getAnnotatorScript } from './annotator.js';

export function createProxyServer({ proxyPort }) {
  // Store latest elements from the annotated page
  let currentElements = [];
  // Command queue: server → browser
  let pendingCommands = [];

  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/';

    // ─── API endpoints (annotator script talks to these) ───

    // CORS headers for all API routes
    if (urlPath.startsWith('/__annotator/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    }

    // Health check
    if (urlPath === '/__annotator/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, elements: currentElements.length }));
      return;
    }

    // Receive elements from browser
    if (urlPath === '/__annotator/elements' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (Array.isArray(data)) currentElements = data;
        } catch(e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }

    // Poll for commands (browser polls this)
    if (urlPath === '/__annotator/commands' && req.method === 'GET') {
      const cmds = pendingCommands;
      pendingCommands = [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cmds));
      return;
    }

    // ─── Proxy logic ───

    // Extract target from URL: /localhost:3847/foo → target=http://localhost:3847, path=/foo
    const match = urlPath.match(/^\/((?:https?:\/\/)?[^/]+)(\/.*)?$/);
    if (!match) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:40px;max-width:600px;margin:0 auto;color:#333">
<h2 style="color:#e11d48">UI Annotator</h2>
<p>Usage: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">http://localhost:${proxyPort}/localhost:PORT</code></p>
<p>Example: <a href="http://localhost:${proxyPort}/localhost:3847">http://localhost:${proxyPort}/localhost:3847</a></p>
<p style="color:#888;margin-top:20px">Opens your page with hover annotations — works in any browser.</p>
</body></html>`);
      return;
    }

    let targetHost = match[1];
    const targetPath = match[2] || '/';
    if (!targetHost.startsWith('http')) targetHost = 'http://' + targetHost;

    let targetUrl;
    try { targetUrl = new URL(targetPath, targetHost); }
    catch(e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid target: ' + targetHost + targetPath);
      return;
    }

    // Proxy the request
    const proxyReq = http.request(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    }, (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] || '';
      const isHTML = contentType.includes('text/html');

      if (!isHTML) {
        // Non-HTML: pass through
        const headers = { ...proxyRes.headers };
        delete headers['content-security-policy'];
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
        return;
      }

      // HTML: collect body, inject annotation script + rewrite URLs
      let body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', (chunk) => { body += chunk; });
      proxyRes.on('end', () => {
        const script = getAnnotatorScript(proxyPort);
        const proxyBase = '/' + targetUrl.host;

        // Rewrite absolute paths in HTML attributes: /foo → /host:port/foo
        // Handles href="/...", src="/...", action="/..."
        body = body.replace(/((?:href|src|action)\s*=\s*["'])\//g, `$1${proxyBase}/`);

        // Rewrite fetch/XHR calls in inline scripts: fetch("/api → fetch("/host:port/api
        // Also handles: fetch('/...) and new Request('/...)
        body = body.replace(/(fetch|Request)\s*\(\s*(['"])\//g, `$1($2${proxyBase}/`);

        // Inject a fetch interceptor script to handle dynamic fetch calls in external JS
        const fetchInterceptor = `<script data-ui-annotator>
(function(){
  var base = '${proxyBase}';
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(base)) {
      url = base + url;
    }
    return origFetch.call(this, url, opts);
  };
  var origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(base)) {
      url = base + url;
    }
    return origXhrOpen.apply(this, [method, url, ...Array.prototype.slice.call(arguments, 2)]);
  };
})();
</script>`;

        // Inject fetch interceptor right after <head> (before any scripts)
        if (body.includes('<head>')) {
          body = body.replace('<head>', '<head>' + fetchInterceptor);
        } else if (/<head[^>]*>/.test(body)) {
          body = body.replace(/<head[^>]*>/, '$&' + fetchInterceptor);
        } else {
          body = fetchInterceptor + body;
        }

        // Inject annotation script before </body> or at end
        if (body.includes('</body>')) {
          body = body.replace('</body>', script + '</body>');
        } else {
          body += script;
        }

        const headers = { ...proxyRes.headers };
        delete headers['content-security-policy'];
        delete headers['content-length'];
        headers['content-type'] = 'text/html; charset=utf-8';

        res.writeHead(proxyRes.statusCode, headers);
        res.end(body);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy error: ' + e.message + '\nTarget: ' + targetUrl.href);
    });

    req.pipe(proxyReq);
  });

  return {
    server,
    getElements: () => currentElements,
    highlight: (name) => { pendingCommands.push({ type: 'highlight', name }); },
    rescan: () => { pendingCommands.push({ type: 'scan' }); },
    inspectOn: () => { pendingCommands.push({ type: 'inspect_on' }); },
    inspectOff: () => { pendingCommands.push({ type: 'inspect_off' }); },
    listen: (port) => new Promise((resolve) => {
      server.listen(port, () => resolve(port));
    }),
  };
}
