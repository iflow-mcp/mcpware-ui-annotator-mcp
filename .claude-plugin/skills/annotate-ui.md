---
name: annotate-ui
description: Annotate a web page with hover labels so you can identify UI elements by name. Use when doing frontend development and you need to reference specific elements.
argument-hint: "<localhost-url> | (no args = auto-detect)"
---

# Annotate UI

When doing frontend development, use the UI Annotator to label page elements so you and the user can reference them by name.

## When to use

- User is working on frontend code and asks about specific UI elements
- User says "change this", "move that", "what's this element called?"
- User starts a dev server (e.g. `npm run dev`, `vite`, `next dev`) and you see a localhost URL
- User asks for design feedback or wants to discuss layout changes

## How to use

### Step 1: Annotate the page

When you detect a localhost URL (from `npm run dev` output, user message, etc.):

```
Use the annotate tool with the localhost URL.
```

This returns a proxy URL (http://localhost:7077/...). Tell the user to open this URL instead of the original localhost URL.

### Step 2: Get elements

Once the user has the page open in the proxy URL:

```
Use get_elements to see all labeled UI elements on the page.
```

This returns element names, CSS selectors, positions, and sizes.

### Step 3: Reference by name

Now you and the user can reference elements by name:
- User: "make the hero-card bigger"
- You know exactly which element `hero-card` is, its selector, and its position
- You can make the code change with confidence

### Step 4: Highlight to confirm

If unsure which element the user means:

```
Use highlight_element with the element name to flash it on the page.
```

The user sees a red flash around the element and can confirm yes/no.

## Tips

- After code changes that affect the DOM, use `rescan_elements` to refresh the element list
- Use `inspect_mode` to let the user click elements and copy their names
- The proxy strips CSP headers, so it works even on strict sites
