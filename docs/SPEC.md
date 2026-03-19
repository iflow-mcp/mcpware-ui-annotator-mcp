# UI Annotator MCP — Product Spec

## What it is

An MCP server that adds interactive hover annotations to any web page via reverse proxy. Users open a proxied URL in any browser — hover any element to see its name, CSS selector, and dimensions. AI coding assistants query the MCP server to understand what elements are on the page.

**The core value: lower the communication cost between humans and AI when discussing UI changes.**

Instead of "that thing on the left, the second item, you know the one with the icon" → user says "the `sidebar-hdr`" because they can see the name on hover.

## Who it's for

- QA testers describing bugs to AI or developers
- Designers communicating UI changes without knowing CSS
- Junior developers learning what page elements are called
- Anyone reviewing a web UI with an AI coding assistant

## How it works

```
User's browser                    MCP Server (Node.js)               AI Assistant
     │                                  │                                 │
     │  GET /localhost:3847             │                                 │
     │ ──────────────────────────────>  │                                 │
     │                                  │  fetch http://localhost:3847    │
     │                                  │ ─────────────────>              │
     │                                  │  <── HTML response              │
     │                                  │                                 │
     │                                  │  inject annotation <script>     │
     │                                  │  inject fetch interceptor       │
     │                                  │  rewrite asset paths            │
     │  <── modified HTML               │                                 │
     │                                  │                                 │
     │  (user hovers elements,          │                                 │
     │   sees names + selectors)        │                                 │
     │                                  │                                 │
     │  POST /__annotator/elements      │                                 │
     │ ──────────────────────────────>  │                                 │
     │                                  │  stores element data            │
     │                                  │                                 │
     │                                  │  <── get_elements()             │
     │                                  │ ────────────────────────────>   │
     │                                  │                                 │
     │  GET /__annotator/commands       │  <── highlight_element("sidebar")
     │ ──────────────────────────────>  │ <────────────────────────────   │
     │  <── [{type:"highlight",...}]    │                                 │
     │                                  │                                 │
     │  (element flashes red)           │                                 │
```

## Architecture

### Zero-dependency reverse proxy
- Built on Node.js `http` module only (no Express, no ws)
- Proxies any `localhost:PORT` target
- Injects annotation script + fetch interceptor into HTML responses
- Rewrites asset paths (`/style.css` → `/localhost:3847/style.css`)
- Monkey-patches `fetch()` and `XMLHttpRequest.open()` so JS API calls route through proxy

### Client-side annotation script
- Auto-scans DOM for named elements (by id, class, semantic role, interactive role)
- Hover overlay: red border follows element shape (respects border-radius)
- Tooltip: shows element name (pink), CSS selector (mono), content preview, dimensions
- Toolbar: Inspect toggle button, element count, collapse/expand
- Inspect mode: click any element → copies name to clipboard
- Reports element data to server via HTTP POST
- Polls for server commands (highlight, rescan, inspect toggle) via GET
- MutationObserver auto-rescans on DOM changes

### MCP server (stdio transport)
- `annotate(url)` — returns proxied URL for user to open
- `get_elements()` — returns all detected elements with names, selectors, positions
- `highlight_element(name)` — flash-highlights an element on the page
- `rescan_elements()` — forces DOM rescan
- `inspect_mode(enabled)` — toggles inspect mode remotely

## Key design decisions

### Why reverse proxy instead of browser extension?
- Works in ANY browser (Chrome, Firefox, Safari, Edge)
- Zero install for the end user — just open a URL
- AI assistant controls it via MCP — no manual setup needed

### Why HTTP polling instead of WebSocket?
- Simpler, more stable — no handshake/frame codec to maintain
- 1-second poll interval is fast enough for command delivery
- Element data sent via POST (not continuous stream) — polling is natural fit

### Why monkey-patch fetch()?
- `<base href>` tag only affects relative URLs, not absolute paths like `/api/scan`
- Apps commonly use absolute fetch paths — interceptor rewrites them through proxy
- Also patches XMLHttpRequest for legacy code

## Competitive landscape

### What exists
| Tool | Approach | Limitation |
|---|---|---|
| MCP Pointer | Chrome extension + MCP | Requires Chrome extension |
| Agentation | Embedded React component + MCP | Requires npm install into your project |
| Cursor Visual Editor | Built-in IDE browser | Only works inside Cursor |
| Windsurf Previews | Built-in IDE browser | Only works inside Windsurf |
| Chrome DevTools MCP | Programmatic DOM access | No visual annotation for humans |
| VisBug | Chrome extension | No MCP, no AI integration |

### Our differentiator
Zero-config, zero-extension, any-browser. Point proxy at any localhost app and get annotations immediately. The only tool that gives both humans (visual overlay) and AI (MCP data) the same element vocabulary simultaneously.

---

## Roadmap

### Phase 1 — MVP (done)
- [x] Reverse proxy with HTML injection
- [x] Hover annotation (overlay + tooltip)
- [x] MCP tools: annotate, get_elements, highlight, rescan, inspect_mode
- [x] Inspect mode: click to copy element name
- [x] Toolbar with collapse/expand
- [x] Fetch interceptor for JS API calls
- [x] Auto-rescan on DOM mutations

### Phase 2 — Polish
- [ ] Human-readable element naming (smart rename: `sn-cat` → `Category Link`)
- [ ] Custom name mapping via JSON config or MCP tool
- [ ] Search/filter elements in toolbar
- [ ] Export element map as markdown/JSON
- [ ] Persist user preferences in localStorage (inspect mode, collapsed state)
- [ ] Multi-tab support (track elements per proxied page separately)
- [ ] README + npm publish

### Phase 3 — Advanced
- [ ] Element grouping by visual region
- [ ] Screenshot + annotation export (labeled PNG)
- [ ] Tooltip theme auto-detection (dark/light based on page)
- [ ] Drag-to-move toolbar
- [ ] SPA/router support (intercept pushState/replaceState)
- [ ] HTTPS proxy support

### Phase 4 — Ecosystem
- [ ] Prebuilt name mappings for popular frameworks (React, Vue, Angular component names)
- [ ] Integration with Figma MCP (map Figma layer names to DOM elements)
- [ ] VS Code extension that auto-starts proxy when dev server runs
- [ ] "Record feedback session" — user hovers + speaks, exported as structured change requests
