# Simple Editor

A tiny, dependency-free WYSIWYG HTML editor for the web.

Plain HTML + CSS + JavaScript. No framework, no build step, no npm install, no transpiling — two files you drop into any page.

```
simple-editor.js   ~83 KB source / ~20 KB gzipped
simple-editor.css  ~14 KB source / ~3.5 KB gzipped
```

Built for the case where TinyMCE/CKEditor is overkill: admin panels, CMS content fields, PHP form pages — "my customer writes a heading, some text, drops in an image and a table, and I save clean HTML."

## Features

- Headings (H1–H4) and paragraph format, with toggle-back
- Bold, italic, underline
- Bulleted and numbered lists, with Tab / Shift+Tab nesting — markers always render inside the editor, even when the host page's CSS reset sets `list-style: none`
- Text color and background color (palette + custom picker) — palettes reorder by usage and remember custom picks in the browser
- Links (insert, edit text, open-in-new-tab, remove) with URL validation — formatting on the linked text is preserved
- Images via URL, file upload, paste, or drag-and-drop — right-click an image to set its width/height (`px` or `%`, e.g. `100%`) and float it left / right or center it
- Tables with header row, **draggable column resizing**, and responsive 100%-width layout
- Horizontal rule insertion
- HTML source view (visual ↔ code toggle) with pretty-printed output
- Undo / redo on the browser's native stack
- Word-paste cleaning and allowlist sanitization of everything
- `<textarea>` integration — works with plain HTML form POST
- English and Turkish UI, custom strings supported
- Theming via CSS variables
- Multiple instances per page, no globals leaked beyond `SimpleEditor`

## Quick start

```html
<link rel="stylesheet" href="simple-editor.css" />

<textarea name="content" id="content">
  <h2>Hello world</h2>
  <p>Existing content is picked up automatically.</p>
</textarea>

<script src="simple-editor.js"></script>
<script>
  var editor = SimpleEditor.create("#content", {
    placeholder: "Write something...",
  });
</script>
```

That's it. If the target is a `<textarea>`, the editor hides it and keeps its `value` in sync on every change — so a classic form POST just works:

```php
<?php
$html = $_POST["content"];        // sanitized editor output
// store it, render it with htmlspecialchars-free echo inside your template
```

The target can also be any block element (`div` works fine); then use `editor.getHTML()` / `editor.setHTML()`.

## Options

```js
SimpleEditor.create(target, {
  language: "en", // "en" or "tr" — UI strings
  placeholder: "", // placeholder text (defaults to the prompt string)
  content: null, // initial HTML; defaults to the target's value/innerHTML
  uploadUrl: null, // POST endpoint for image uploads (see "Images")
  maxHeight: 0, // max editing-area height in px (0 = default 60vh)
  strings: {}, // per-instance string overrides (see "Translations")
});
```

## API

### Instance methods

| Method                        | Description                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor.getHTML()`            | Returns the current content as sanitized, normalized HTML. Never returns unsanitized markup.                                                                   |
| `editor.setHTML(html, opts?)` | Replaces the content. `opts.silent: true` skips change events; `opts.preserveUndo: true` routes the change through the native undo stack so Ctrl+Z reverts it. |
| `editor.onChange(cb)`         | Registers `cb(html, editor)` — fired (batched per frame) on typing, commands, paste, drop, source-apply, and setHTML.                                          |
| `editor.focus()`              | Focuses the editing area (or the source textarea in source mode).                                                                                              |
| `editor.destroy()`            | Removes the editor, restores the original `<textarea>`/element with the current content, and detaches all listeners.                                           |

### Statics

| Property                               | Description                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `SimpleEditor.create(target, options)` | Creates and returns an editor instance.                                                                                 |
| `SimpleEditor.sanitize(html)`          | Standalone access to the sanitizer/normalizer — useful for cleaning input on the server-side-rendered side of your app. |
| `SimpleEditor.strings`                 | The built-in translation dictionaries (`en`, `tr`).                                                                     |
| `SimpleEditor.version`                 | Current version string.                                                                                                 |

### Keyboard shortcuts

| Keys                                | Action                                       |
| ----------------------------------- | -------------------------------------------- |
| Ctrl/⌘ + B / I / U                  | Bold / italic / underline                    |
| Ctrl/⌘ + K                          | Insert link                                  |
| Ctrl/⌘ + Alt + 1 / 2 / 3 / 4        | Heading 1 / 2 / 3 / 4                        |
| Ctrl/⌘ + Alt + 0                    | Back to paragraph                            |
| Tab / Shift+Tab (inside a list)     | Indent / outdent the list item (nests lists) |
| Ctrl/⌘ + Z / Y                      | Undo / redo                                  |
| Right-click / double-click an image | Image size & alignment menu                  |

## Tables

- Insert via the toolbar: choose rows × columns (1–50), optional header row.
- **Resize columns**: hover an internal column border until it turns blue, then drag. The table switches to `table-layout: fixed` while you drag, then commits widths as **percentages** on `<col>` elements:

```html
<table>
  <colgroup>
    <col style="width: 62.5%" />
    <col style="width: 37.5%" />
  </colgroup>
  <tbody>
    ...
  </tbody>
</table>
```

- Inside the editor, tables are always `width: 100%` and cells wrap long words — no layout breakage on narrow screens.
- Saved content needs the same rules on your site. The demo ships this copy-paste block for your page templates:

```css
.content table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.content td,
.content th {
  border: 1px solid #d1d5db;
  padding: 6px 10px;
  overflow-wrap: break-word;
}
.content th {
  background: #f9fafb;
}

@media (max-width: 640px) {
  .content td,
  .content th {
    padding: 4px 6px;
  }
}

/* list markers — add these too if your site ships a CSS reset */
.content ul {
  list-style-type: disc;
}
.content ol {
  list-style-type: decimal;
}
```

Notes: column resizes are not on the undo stack (re-drag to change), and tables containing `colspan` are skipped by the resizer.

## Images

Four ways to get an image in:

1. **URL** — paste a link in the image dialog.
2. **File picker** — choose a file in the dialog.
3. **Paste** — paste a screenshot or copied image anywhere in the editor.
4. **Drag & drop** — drop an image file onto the editing area.

With `uploadUrl` set, files are POSTed as `multipart/form-data` with the field name `file`. The endpoint must respond with either JSON or a plain URL string:

```js
SimpleEditor.create("#content", { uploadUrl: "/upload.php" });
```

```php
<?php
// upload.php — minimal example
if (!isset($_FILES["file"]) || $_FILES["file"]["error"] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  exit(json_encode(["error" => "upload failed"]));
}

$f = $_FILES["file"];
$type = mime_content_type($f["tmp_name"]);
if (!in_array($type, ["image/jpeg", "image/png", "image/gif", "image/webp"], true)) {
  http_response_code(415);
  exit(json_encode(["error" => "not an image"]));
}

$dir = __DIR__ . "/uploads/" . date("Y/m");
if (!is_dir($dir)) mkdir($dir, 0755, true);

$name = bin2hex(random_bytes(8)) . "-" . basename($f["name"]);
move_uploaded_file($f["tmp_name"], "$dir/$name");

echo json_encode(["url" => "/uploads/" . date("Y/m") . "/" . $name]);
```

Accepted response shapes: `{"url": "..."}` (also `src`, `file`, or `data.url` keys), or the body being just the URL text.

**Without `uploadUrl`**, the editor stays fully client-side and embeds files as base64 `data:` URLs. Convenient for demos, but it bloats the HTML — configure an endpoint for real projects.

The sanitizer only accepts `data:image/png|jpeg|gif|webp|avif;base64,...` URLs, so a hostile `data:text/html` payload never survives.

### Sizing and alignment

Right-click (or double-click) any image in the editing area to open the image menu:

- **Width / height** — enter values like `320`, `100%`, or leave a field empty for the natural size (`auto`). Plain numbers mean pixels. A width without a height keeps the aspect ratio (`height: auto` is written along with it), and `100%` gives a full-width image.
- **Alignment** — float left, float right (text wraps around the image), center (block with auto margins), or inline (no alignment at all).

Alignment buttons apply immediately and the menu stays open, so you can flip between options; `Apply` commits the size fields. `Enter` applies, `Esc` or an outside click closes.

The styles are written onto the `<img>` tag itself and survive the sanitizer:

```html
<img
  src="..."
  alt=""
  style="width: 100%; height: auto; display: block; margin-left: auto; margin-right: auto"
/>
<img
  src="..."
  alt=""
  style="width: 320px; height: auto; float: left; margin: 0 1em 1em 0"
/>
```

Like column resizes, size/alignment changes are direct DOM edits — they are not on the native undo stack.

## Security: how content is cleaned

Everything that enters the editor — `setHTML()`, paste, drop, source-view apply, and `getHTML()` output — passes through the same allowlist pipeline:

1. **Parse** in an inert `<template>` (scripts never run, images never load during parsing).
2. **Normalize** legacy browser output: `<font color>` → `<span style="color:">`, `<b>`/`<i>`/`<strike>` → `<strong>`/`<em>`/`<s>`, empty spans unwrapped.
3. **Drop** dangerous elements _with_ content: `script`, `style`, `iframe`, `object`, `embed`, `form`, `svg`, `meta`, `link`, ...
4. **Unwrap** unknown-but-harmless elements (tag removed, children kept).
5. **Filter attributes** to a per-tag allowlist, and validate the survivors:
   - `href`/`src`: only `http`, `https`, `mailto`, `tel`, relative URLs, and (for images) the image `data:` formats above — `javascript:` URLs are removed.
   - `style`: only `color`/`background-color` with real color values, plus `width` on `<col>` (resizer) and, on `<img>`, the image-menu styles — `width`/`height` in px/%/`auto`, `float: left|right|none`, `display: block`, `auto` side margins, and non-negative `margin` lengths.
   - `target`: only `_blank`, which also gets `rel="noopener noreferrer"` forced.
   - `colspan`/`rowspan`: 1–99 integers only.
6. **Remove** comments and whitespace-only nodes inside structural containers.

The philosophy: the editor can only emit markup the toolbar itself can produce. If you need to trust nothing, this is the layer that earns it.

## HTML source mode

The `</>` button (or the "HTML source" title) toggles between visual editing and a source textarea:

- Opening serializes the content **pretty-printed** (block elements on their own lines, nested indentation), with the caret at the top.
- **Apply** re-enters the content through the full sanitizer — anything invalid is dropped, exactly like paste.
- **Cancel** discards edits.
- The rest of the toolbar is disabled while in source mode.

## Theming

All colors are CSS variables declared on `.se-root` (and `.se-overlay` / `.se-ctxmenu`, since modals and the image context menu mount on `<body>` and sit outside the editor's cascade):

```css
.se-root {
  --se-border: #d1d5db; /* main borders */
  --se-border-soft: #e5e7eb; /* dividers, panel borders */
  --se-bg: #ffffff; /* surfaces */
  --se-bg-soft: #f9fafb; /* toolbar, modal footer */
  --se-fg: #111827; /* text */
  --se-fg-muted: #6b7280; /* hints, placeholders */
  --se-accent: #2563eb; /* buttons, focus, links */
  --se-accent-soft: #dbeafe; /* active button background */
  --se-danger: #dc2626; /* error text */
}
```

Override them globally, per instance (`editor.root.style.setProperty("--se-accent", "#16a34a")`), or via a class — modals pick up the instance's computed theme automatically when they open.

## Translations

Built-in: `en`, `tr`. Pick with `language: "tr"`, or override individual strings per instance — keys are listed in the `STRINGS` object at the top of `simple-editor.js`:

```js
SimpleEditor.create("#content", {
  language: "en",
  strings: {
    prompt: "Start typing…",
    insert: "Add",
  },
});
```

## How it works (architecture notes)

If you want to hack on it, the mental model in ~2,600 lines of vanilla JS:

- **Editing core** — a `contenteditable` div driven by `document.execCommand()`. `execCommand` is officially deprecated but universally implemented and perfectly adequate for this feature set; the real work is everything _around_ it.
- **Selection preservation** — toolbar buttons `preventDefault()` on `mousedown` so focus never leaves the editing area; modals save the DOM range on open and restore it before applying. This is the #1 homemade-editor bug and the reason toolbar clicks just work here.
- **Undo coherence** — every programmatic change (links, tables, images, pastes, `setHTML({preserveUndo:true})`) goes through `execCommand` (`insertHTML` / `createLink`) instead of direct DOM mutation, so the browser's native undo stack stays consistent. Direct mutations (column resizing, image size/alignment, patching `target`/`rel` onto a fresh link) are the known exceptions.
- **Link formatting** — linking already-formatted text (bold, underline, colors) goes through `createLink`, which wraps the selection in place so its markup survives, and splits partial selections correctly. The plain-text `insertHTML` path only handles the changed-text or empty-selection cases.
- **Sanitizer** — a single `cleanTree()` pass (normalize → drop → unwrap → attribute filter) reused by every input and output path, including the standalone `SimpleEditor.sanitize()`.
- **Source mode** — a custom serializer produces indented HTML for the textarea; Apply round-trips it through the sanitizer.
- **Color memory** — color panels rebuild every time they open: remembered colors lead (most used, then most recent), the untouched base palette follows. Colors picked with the OS picker join the swatches so they can be reused; the list is stored per panel in `localStorage` under `simple-editor:color-usage` (max 6 custom colors) and degrades to page memory when storage is blocked.
- **Column resizing** — mousemove hit-testing against first-row cell borders; widths stored on `<colgroup>`/`<col>` (sanitizer allows `width` there and nowhere else); percentages on commit keep tables responsive.
- **Image menu** — `contextmenu`/`dblclick` hit-testing against `<img>`; size and float/center styles are written inline on the image and validated by the same style filter that guards pasted markup. The menu mounts on `<body>` (like modals) with the instance's theme copied onto it.
- **Styling** — BEM-ish `se-` class prefix, CSS variables for theme, no `!important` except the two `[hidden]` guards. Editor chrome is scoped to `.se-root`; document typography is scoped to `.se-content` so it never leaks into your page.

## Browser support

Modern evergreen browsers: Chrome, Edge, Firefox, Safari (desktop and mobile). IE 11 is not supported (`<template>`, `fetch`, `closest`).

## Limitations & roadmap

Current, deliberate limits:

- No table row/column add/remove UI yet (top roadmap item)
- Column resize and image size/alignment changes are mouse-only and not undoable
- No nested list controls, text-alignment buttons, or find/replace
- Single-level undo of column resizes
- Color memory is browser-local (`localStorage`) — never sent to the server, and it does not follow the user across devices

## Project layout

```
simple-editor.js    the whole editor (IIFE, exposes window.SimpleEditor)
simple-editor.css   chrome + document typography + modals + source mode
demo/index.html     showcase page with live getHTML() output
README.md           this file
```

Run the demo from this folder with any static server, e.g. `npx serve` or `python -m http.server`, and open `demo/`.

## License

MIT — free for personal and commercial use, modification, and redistribution. Keep the license notice in the file headers.
