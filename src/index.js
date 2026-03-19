#!/usr/bin/env node

// UI Annotator MCP Server
// Injects hover annotations into any web page via reverse proxy
// Zero browser extensions — works with any browser

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createProxyServer } from './proxy.js';

const PROXY_PORT = parseInt(process.env.UI_ANNOTATOR_PORT || '7077');

// ─── Create proxy server ───
let latestElements = [];
const proxy = createProxyServer({
  proxyPort: PROXY_PORT,
  wsPort: PROXY_PORT,
  onElements: (els) => { latestElements = els; },
});

// Start proxy server
await proxy.listen(PROXY_PORT);
process.stderr.write(`[ui-annotator] Proxy running on http://localhost:${PROXY_PORT}\n`);

// ─── MCP Server ───
const mcp = new McpServer({
  name: 'ui-annotator',
  version: '0.1.0',
});

// Tool 1: Annotate a page — returns the proxy URL
mcp.tool(
  'annotate',
  'Open a web page with hover annotations. Returns a proxy URL that adds interactive element labels to any page. User opens this URL in any browser to see annotations on hover.',
  {
    url: z.string().describe('The target URL to annotate, e.g. "http://localhost:3847" or "localhost:3847"'),
  },
  async ({ url }) => {
    let target = url;
    if (!target.startsWith('http')) target = 'http://' + target;
    let parsed;
    try {
      parsed = new URL(target);
    } catch(e) {
      return { content: [{ type: 'text', text: 'Invalid URL: ' + url }], isError: true };
    }

    const proxyUrl = `http://localhost:${PROXY_PORT}/${parsed.host}${parsed.pathname}`;
    return {
      content: [{
        type: 'text',
        text: `Annotated URL ready:\n\n${proxyUrl}\n\nOpen this URL in any browser. Hover over any element to see its name, CSS selector, and dimensions. The annotation works in Chrome, Firefox, Safari — any browser.\n\nOnce the user has the page open, use get_elements to see what UI elements are on the page.`,
      }],
    };
  }
);

// Tool 2: Get all detected elements on the page
mcp.tool(
  'get_elements',
  'Get all UI elements detected on the currently annotated page. Returns element names, CSS selectors, positions, and sizes. Use this to understand what the user is referring to when they describe a UI element.',
  {},
  async () => {
    const els = proxy.getElements();
    if (els.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No elements detected. Make sure the user has opened the annotated proxy URL in their browser. Use the annotate tool first to get the proxy URL.',
        }],
      };
    }

    // Group elements by source type for readability
    const grouped = {};
    for (const el of els) {
      const key = el.source || 'other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(el);
    }

    let output = `Found ${els.length} UI elements on the page:\n\n`;

    for (const [source, items] of Object.entries(grouped)) {
      output += `## ${source.toUpperCase()} (${items.length})\n`;
      for (const el of items) {
        output += `- **${el.name}** — \`${el.selector}\` (${el.rect.w}×${el.rect.h}px at ${el.rect.x},${el.rect.y})`;
        if (el.text && el.text !== el.name) output += ` "${el.text.slice(0, 50)}"`;
        output += '\n';
      }
      output += '\n';
    }

    return { content: [{ type: 'text', text: output }] };
  }
);

// Tool 3: Highlight a specific element
mcp.tool(
  'highlight_element',
  'Briefly flash-highlight a specific element on the page so the user can see which element you are referring to. Useful for confirming "do you mean this element?"',
  {
    name: z.string().describe('The element name or CSS selector to highlight'),
  },
  async ({ name }) => {
    proxy.highlight(name);
    return {
      content: [{
        type: 'text',
        text: `Highlighted "${name}" on the page. The user should see a brief red flash around the element.`,
      }],
    };
  }
);

// Tool 4: Rescan page elements
mcp.tool(
  'rescan_elements',
  'Force the annotated page to rescan all UI elements. Use this after the page content has changed (e.g. after navigation, DOM updates, or user interaction).',
  {},
  async () => {
    proxy.rescan();
    // Wait a moment for the scan to complete
    await new Promise(r => setTimeout(r, 500));
    const count = proxy.getElements().length;
    return {
      content: [{
        type: 'text',
        text: `Rescanned page. Found ${count} elements.`,
      }],
    };
  }
);

// Tool 5: Toggle inspect mode
mcp.tool(
  'inspect_mode',
  'Toggle inspect mode on the annotated page. When ON, the user can click any element to copy its name. When OFF, the page behaves normally. Use this to help the user copy element names for communicating design changes.',
  {
    enabled: z.boolean().describe('true to enable inspect mode, false to disable'),
  },
  async ({ enabled }) => {
    if (enabled) {
      proxy.inspectOn();
    } else {
      proxy.inspectOff();
    }
    return {
      content: [{
        type: 'text',
        text: enabled
          ? 'Inspect mode ON. The user can now click any element to copy its name. A toolbar indicator shows the mode is active.'
          : 'Inspect mode OFF. Page is back to normal interactive mode.',
      }],
    };
  }
);

// ─── Connect MCP via stdio ───
const transport = new StdioServerTransport();
await mcp.connect(transport);
