/*!
 * Simple Editor — a tiny, dependency-free WYSIWYG HTML editor.
 *
 * Plain HTML + CSS + JS. No framework, no build step, no dependencies.
 * MIT License.
 *
 * Usage:
 *   <script src="simple-editor.js"></script>
 *   SimpleEditor.create("#my-editor", { placeholder: "Write something..." });
 *
 * API:
 *   var editor = SimpleEditor.create(target, options)
 *   editor.getHTML()            -> sanitized, normalized HTML string
 *   editor.setHTML(html, opts)  -> opts: { silent, preserveUndo }
 *   editor.onChange(cb)         -> cb(html, editor), fired on every change
 *   editor.focus() / editor.destroy()
 *
 * If the target is a <textarea>, the editor hides it and keeps its value
 * in sync, so it works with plain HTML form POSTs (e.g. PHP panels).
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.8";

  // Custom properties that must be copied from the editor root onto
  // body-level modals — they are mounted outside .se-root and therefore
  // cannot inherit the editor's variables through the CSS cascade.
  var CSS_VARS = [
    "--se-border",
    "--se-border-soft",
    "--se-bg",
    "--se-bg-soft",
    "--se-fg",
    "--se-fg-muted",
    "--se-accent",
    "--se-accent-soft",
    "--se-danger",
  ];

  // ------------------------------------------------------------------
  // UI strings
  // ------------------------------------------------------------------

  var STRINGS = {
    en: {
      blockFormat: "Paragraph format",
      paragraph: "Paragraph",
      heading1: "Heading 1",
      heading2: "Heading 2",
      heading3: "Heading 3",
      heading4: "Heading 4",
      bold: "Bold (Ctrl+B)",
      italic: "Italic (Ctrl+I)",
      underline: "Underline (Ctrl+U)",
      listBullets: "Bulleted list",
      listNumbers: "Numbered list",
      textColor: "Text color",
      bgColor: "Background color",
      customColor: "Custom…",
      link: "Insert link (Ctrl+K)",
      unlink: "Remove link",
      image: "Insert image",
      imageProps: "Image properties",
      imageWidth: "Width",
      imageHeight: "Height",
      imageSizeHint: "Values in px or % (e.g. 100%); empty = auto",
      invalidSize: "Width/height must look like 320 or 100% — or be empty.",
      alignLeft: "Float left",
      alignCenter: "Center",
      alignRight: "Float right",
      alignInline: "Inline (remove alignment)",
      table: "Insert table",
      horizontalRule: "Horizontal rule",
      source: "HTML source",
      undo: "Undo (Ctrl+Z)",
      redo: "Redo (Ctrl+Y)",
      url: "URL",
      linkText: "Link text",
      openNewTab: "Open in new tab",
      altText: "Alternative text (alt)",
      chooseFile: "Choose file…",
      base64Hint:
        "No upload endpoint is configured — the image will be embedded as base64.",
      rows: "Rows",
      columns: "Columns",
      headerRow: "First row is a header",
      insert: "Insert",
      apply: "Apply",
      cancel: "Cancel",
      close: "Close",
      invalidUrl: "Please enter a valid URL (http, https, mailto or relative).",
      invalidImage: "The chosen file is not an image.",
      urlOrFile: "Enter a URL or choose a file.",
      uploadFailed: "Upload failed.",
      uploading: "Uploading…",
      prompt: "Write something…",
    },
    tr: {
      blockFormat: "Paragraf biçimi",
      paragraph: "Paragraf",
      heading1: "Başlık 1",
      heading2: "Başlık 2",
      heading3: "Başlık 3",
      heading4: "Başlık 4",
      bold: "Kalın (Ctrl+B)",
      italic: "İtalik (Ctrl+I)",
      underline: "Altı çizili (Ctrl+U)",
      listBullets: "Madde işaretli liste",
      listNumbers: "Numaralı liste",
      textColor: "Yazı rengi",
      bgColor: "Arka plan rengi",
      customColor: "Özel…",
      link: "Bağlantı ekle (Ctrl+K)",
      unlink: "Bağlantıyı kaldır",
      image: "Resim ekle",
      imageProps: "Resim özellikleri",
      imageWidth: "Genişlik",
      imageHeight: "Yükseklik",
      imageSizeHint: "Değerler px veya % (örn. 100%); boş = otomatik",
      invalidSize:
        "Genişlik/yükseklik 320 ya da 100% biçiminde olmalı — ya da boş.",
      alignLeft: "Sola yasla",
      alignCenter: "Ortala",
      alignRight: "Sağa yasla",
      alignInline: "Satır içi (hizalamayı kaldır)",
      table: "Tablo ekle",
      horizontalRule: "Yatay çizgi",
      source: "HTML kaynağı",
      undo: "Geri al (Ctrl+Z)",
      redo: "Yinele (Ctrl+Y)",
      url: "URL",
      linkText: "Bağlantı metni",
      openNewTab: "Yeni sekmede aç",
      altText: "Alternatif metin (alt)",
      chooseFile: "Dosya seç…",
      base64Hint:
        "Yükleme adresi tanımlı değil — resim base64 olarak gömülecek.",
      rows: "Satır",
      columns: "Sütun",
      headerRow: "İlk satır başlık olsun",
      insert: "Ekle",
      apply: "Uygula",
      cancel: "Vazgeç",
      close: "Kapat",
      invalidUrl:
        "Geçerli bir URL girin (http, https, mailto veya göreli adres).",
      invalidImage: "Seçilen dosya bir resim değil.",
      urlOrFile: "Bir URL girin ya da dosya seçin.",
      uploadFailed: "Yükleme başarısız.",
      uploading: "Yükleniyor…",
      prompt: "Yazmaya başlayın…",
    },
  };

  // ------------------------------------------------------------------
  // Small utilities
  // ------------------------------------------------------------------

  var ESC_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ESC_MAP[c];
    });
  }

  function merge(target, src) {
    Object.keys(src || {}).forEach(function (k) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
        target[k] = merge(
          target[k] && typeof target[k] === "object" ? target[k] : {},
          src[k],
        );
      } else {
        target[k] = src[k];
      }
    });
    return target;
  }

  function pad(depth) {
    return new Array(depth + 1).join("  ");
  }

  // ------------------------------------------------------------------
  // Sanitizer — allowlist-based. Everything the toolbar cannot produce
  // is either unwrapped (tag removed, children kept) or dropped with
  // its content (script, style, iframe, event handlers, ...).
  // ------------------------------------------------------------------

  var ALLOWED_TAGS = {
    P: [],
    H1: [],
    H2: [],
    H3: [],
    H4: [],
    BR: [],
    HR: [],
    STRONG: [],
    EM: [],
    U: [],
    S: [],
    SPAN: ["style"],
    A: ["href", "title", "target", "rel"],
    IMG: ["src", "alt", "title", "style"],
    UL: [],
    OL: [],
    LI: [],
    TABLE: [],
    COLGROUP: [],
    COL: ["style"],
    THEAD: [],
    TBODY: [],
    TR: [],
    TD: ["colspan", "rowspan"],
    TH: ["colspan", "rowspan"],
    BLOCKQUOTE: [],
  };

  // Removed together with all of their content.
  var DROP_TAGS = {
    SCRIPT: 1,
    STYLE: 1,
    NOSCRIPT: 1,
    IFRAME: 1,
    FRAME: 1,
    FRAMESET: 1,
    OBJECT: 1,
    EMBED: 1,
    APPLET: 1,
    META: 1,
    LINK: 1,
    BASE: 1,
    TITLE: 1,
    HEAD: 1,
    SVG: 1,
    MATH: 1,
    FORM: 1,
    INPUT: 1,
    BUTTON: 1,
    SELECT: 1,
    OPTION: 1,
    TEXTAREA: 1,
    VIDEO: 1,
    AUDIO: 1,
    SOURCE: 1,
    TRACK: 1,
    CANVAS: 1,
    MAP: 1,
    AREA: 1,
  };

  var COLOR_RE =
    /^(#[0-9a-f]{3,8}|rgba?\(\s*[0-9.]+%?\s*(,\s*[0-9.]+%?\s*){2}\s*(,\s*[0-9.]+\s*)?\)|hsla?\(\s*[0-9.]+(deg)?\s*(,\s*[0-9.]+%\s*){2}\s*(,\s*[0-9.]+\s*)?\)|[a-z]{3,26})$/i;

  // Widths set by the column resize handles: px during the drag,
  // committed as percentages of the table width afterwards.
  var WIDTH_RE = /^\d+(\.\d+)?(px|%)$/;

  function safeUrl(raw, allowImage) {
    if (raw == null) return null;
    var s = String(raw)
      .trim()
      .replace(/[\u0000-\u001f\u007f]/g, "");
    if (!s) return null;
    var m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(s);
    if (m) {
      var p = m[1].toLowerCase();
      if (p === "http" || p === "https" || p === "mailto" || p === "tel")
        return s;
      if (allowImage && p === "data") {
        return /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(
          s,
        )
          ? s
          : null;
      }
      return null;
    }
    return s; // relative URL, #anchor or protocol-relative
  }

  // Margin shorthand the image menu writes next to floats: 1–4
  // non-negative lengths (px, em, %) — e.g. "0 1em 1em 0".
  var IMG_MARGIN_RE =
    /^(0|\d+(\.\d+)?(px|em|%))( (0|\d+(\.\d+)?(px|em|%))){0,3}$/;

  // Keeps only color / background-color with sane values. <col> elements
  // may additionally carry a width (px or %) set by the resize handles;
  // <img> elements may carry the size/alignment styles produced by the
  // image context menu (width, height, float, display, margins).
  function filterStyle(styleStr, opts) {
    if (!styleStr) return "";
    var out = [];
    String(styleStr)
      .split(";")
      .forEach(function (part) {
        var i = part.indexOf(":");
        if (i < 0) return;
        var prop = part.slice(0, i).trim().toLowerCase();
        var val = part.slice(i + 1).trim();
        if (
          (prop === "color" || prop === "background-color") &&
          COLOR_RE.test(val)
        ) {
          out.push(prop + ": " + val);
        } else if (opts.img) {
          if (
            (prop === "width" || prop === "height") &&
            (val === "auto" || WIDTH_RE.test(val))
          ) {
            out.push(prop + ": " + val);
          } else if (
            prop === "float" &&
            (val === "left" || val === "right" || val === "none")
          ) {
            out.push(prop + ": " + val);
          } else if (prop === "display" && val === "block") {
            out.push(prop + ": " + val);
          } else if (
            (prop === "margin-left" || prop === "margin-right") &&
            val === "auto"
          ) {
            out.push(prop + ": " + val);
          } else if (prop === "margin" && IMG_MARGIN_RE.test(val)) {
            out.push(prop + ": " + val);
          }
        } else if (opts.width && prop === "width" && WIDTH_RE.test(val)) {
          out.push(prop + ": " + val);
        }
      });
    return out.join("; ");
  }

  function parseHTML(html) {
    // <template> content is inert: scripts do not run, images do not load.
    var tpl = document.createElement("template");
    tpl.innerHTML = String(html);
    return tpl.content;
  }

  function unwrap(el) {
    var parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function rename(el, newTag) {
    var n = document.createElement(newTag);
    for (var i = 0; i < el.attributes.length; i++) {
      n.setAttribute(el.attributes[i].name, el.attributes[i].value);
    }
    while (el.firstChild) n.appendChild(el.firstChild);
    el.parentNode.replaceChild(n, el);
  }

  // ------------------------------------------------------------------
  // Normalizer — turns legacy browser output into clean, modern markup:
  //   <font color>      -> <span style="color: ...">
  //   <font style=bg>   -> <span style="background-color: ...">
  //   <b> <i> <strike>  -> <strong> <em> <s>
  //   empty spans       -> unwrapped
  // ------------------------------------------------------------------

  function normalizeTree(root) {
    Array.prototype.slice
      .call(root.querySelectorAll("font, b, i, strike"))
      .forEach(function (el) {
        if (!el.parentNode) return;
        var tag = el.tagName;
        if (tag === "FONT") {
          var styles = [];
          var attrColor = el.getAttribute("color");
          var cssColor = el.style ? el.style.color : "";
          var cssBg = el.style ? el.style.backgroundColor : "";
          if (attrColor && COLOR_RE.test(attrColor))
            styles.push("color: " + attrColor);
          if (cssColor && COLOR_RE.test(cssColor))
            styles.push("color: " + cssColor);
          if (cssBg && COLOR_RE.test(cssBg))
            styles.push("background-color: " + cssBg);
          var span = document.createElement("span");
          if (styles.length) span.setAttribute("style", styles.join("; "));
          while (el.firstChild) span.appendChild(el.firstChild);
          el.parentNode.replaceChild(span, el);
        } else if (tag === "B") {
          rename(el, "STRONG");
        } else if (tag === "I") {
          rename(el, "EM");
        } else if (tag === "STRIKE") {
          rename(el, "S");
        }
      });
  }

  function sanitizeTree(root) {
    // 1. Drop comments.
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
    var comments = [];
    while (tw.nextNode()) comments.push(tw.currentNode);
    comments.forEach(function (c) {
      if (c.parentNode) c.parentNode.removeChild(c);
    });

    // 2. Drop whitespace-only text nodes in structural containers.
    var containers = [root].concat(
      Array.prototype.slice.call(
        root.querySelectorAll("table, colgroup, thead, tbody, tr, ul, ol"),
      ),
    );
    containers.forEach(function (el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3 && !n.nodeValue.trim() && n.parentNode) {
          n.parentNode.removeChild(n);
        }
      });
    });

    // 3. Filter every element.
    Array.prototype.slice
      .call(root.querySelectorAll("*"))
      .forEach(function (el) {
        if (!el.parentNode) return; // already detached by an earlier step
        var tag = el.tagName;
        if (DROP_TAGS[tag]) {
          el.parentNode.removeChild(el);
          return;
        }
        if (!ALLOWED_TAGS[tag]) {
          unwrap(el);
          return;
        }

        var allowed = ALLOWED_TAGS[tag];
        var kill = false;

        Array.prototype.slice.call(el.attributes).forEach(function (a) {
          var name = a.name.toLowerCase();
          if (allowed.indexOf(name) === -1) {
            el.removeAttribute(a.name);
            return;
          }
          if (name === "href") {
            var u = safeUrl(a.value, false);
            if (u === null) el.removeAttribute(a.name);
            else el.setAttribute(a.name, u);
          } else if (name === "src") {
            var s = safeUrl(a.value, tag === "IMG");
            if (s === null) kill = true;
            else el.setAttribute(a.name, s);
          } else if (name === "style") {
            var st = filterStyle(a.value, {
              width: tag === "COL",
              img: tag === "IMG",
            });
            if (st) el.setAttribute("style", st);
            else el.removeAttribute("style");
          } else if (name === "target") {
            if (a.value !== "_blank") el.removeAttribute(a.name);
          } else if (name === "rel") {
            el.setAttribute("rel", "noopener noreferrer");
          } else if (name === "colspan" || name === "rowspan") {
            if (!/^[1-9]\d?$/.test(a.value)) el.removeAttribute(a.name);
          }
        });

        if (kill) {
          if (el.parentNode) el.parentNode.removeChild(el);
          return;
        }

        if (tag === "A") {
          if (!el.getAttribute("href")) {
            unwrap(el);
            return;
          }
          if (el.getAttribute("target") === "_blank")
            el.setAttribute("rel", "noopener noreferrer");
        } else if (tag === "IMG" && !el.getAttribute("src")) {
          if (el.parentNode) el.parentNode.removeChild(el);
        } else if (tag === "SPAN" && !el.getAttribute("style")) {
          unwrap(el);
        }
      });
  }

  function cleanTree(root) {
    normalizeTree(root);
    sanitizeTree(root);
    return root;
  }

  // Parse, clean and re-serialize an arbitrary HTML string.
  function cleanHTMLString(html) {
    var frag = parseHTML(html);
    cleanTree(frag);
    var div = document.createElement("div");
    div.appendChild(frag);
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // Serializers
  // ------------------------------------------------------------------

  var BLOCK_SET = {
    p: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    ul: 1,
    ol: 1,
    li: 1,
    table: 1,
    colgroup: 1,
    col: 1,
    thead: 1,
    tbody: 1,
    tr: 1,
    td: 1,
    th: 1,
    blockquote: 1,
    hr: 1,
    div: 1,
  };

  function serAttrs(el) {
    var out = "";
    Array.prototype.forEach.call(el.attributes, function (a) {
      out += " " + a.name + '="' + escapeHtml(a.value) + '"';
    });
    return out;
  }

  function serNode(node, depth) {
    if (node.nodeType === 3) {
      var t = escapeHtml(node.nodeValue).replace(/\s+/g, " ");
      return t === " " ? "" : t;
    }
    if (node.nodeType !== 1) return "";
    var tag = node.tagName.toLowerCase();
    var open = "<" + tag + serAttrs(node) + ">";
    if (tag === "br") return open;
    if (tag === "hr" || tag === "img" || tag === "col")
      return "\n" + pad(depth) + open;

    var childHasBlock = false;
    Array.prototype.forEach.call(node.childNodes, function (c) {
      if (c.nodeType === 1 && BLOCK_SET[c.tagName.toLowerCase()])
        childHasBlock = true;
    });

    var inner = "";
    if (childHasBlock) {
      var parts = [];
      Array.prototype.forEach.call(node.childNodes, function (c) {
        var s = serNode(c, depth + 1);
        if (s) parts.push("\n" + pad(depth + 1) + s);
      });
      inner = parts.join("") + "\n" + pad(depth);
    } else {
      Array.prototype.forEach.call(node.childNodes, function (c) {
        inner += serNode(c, depth + 1);
      });
      inner = inner.trim();
    }
    return "\n" + pad(depth) + open + inner + "</" + tag + ">";
  }

  // Pretty-printed HTML for the source view.
  function prettySerialize(html) {
    var frag = parseHTML(html);
    var out = [];
    Array.prototype.forEach.call(frag.childNodes, function (n) {
      var s = serNode(n, 0);
      if (s) out.push(s);
    });
    return out
      .join("")
      .replace(/^\n+|\n+$/g, "")
      .replace(/\n{3,}/g, "\n\n");
  }

  // Plain text -> paragraphs (used when pasting without HTML).
  function textToHTML(text) {
    var out = [];
    String(text)
      .split(/\n{2,}/)
      .forEach(function (p) {
        if (!p.trim()) return;
        out.push("<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>");
      });
    return out.join("");
  }

  // ------------------------------------------------------------------
  // Icons (inline SVG, stroke = currentColor)
  // ------------------------------------------------------------------

  function svg(inner) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  var ICONS = {
    link: svg(
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
        '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    ),
    unlink: svg(
      '<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
        '<path d="M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' +
        '<line x1="8.59" y1="8.59" x2="15.41" y2="15.41"/>',
    ),
    listUl: svg(
      '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>' +
        '<line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>' +
        '<line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    ),
    listOl: svg(
      '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>' +
        '<line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/>' +
        '<path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    ),
    image: svg(
      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
        '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    ),
    table: svg(
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
        '<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>' +
        '<line x1="12" y1="3" x2="12" y2="21"/>',
    ),
    hr: svg('<line x1="4" y1="12" x2="20" y2="12" stroke-width="3"/>'),
    code: svg(
      '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    ),
    undo: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
    redo: svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>'),
    textColor: svg(
      '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="14" x2="15" y2="14"/>' +
        '<line x1="12" y1="4" x2="12" y2="14"/><line x1="5" y1="20" x2="19" y2="20" stroke-width="3"/>',
    ),
    bgColor: svg(
      '<path d="m9 11-6 6v3h9l3-3"/>' +
        '<path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    ),
    caret: svg('<polyline points="6 9 12 15 18 9"/>'),
    imgLeft: svg(
      '<rect x="3" y="5" width="9" height="9" rx="1"/>' +
        '<line x1="15" y1="7" x2="21" y2="7"/><line x1="15" y1="11" x2="21" y2="11"/>' +
        '<line x1="3" y1="18" x2="21" y2="18"/>',
    ),
    imgCenter: svg(
      '<line x1="4" y1="3" x2="20" y2="3"/><rect x="6" y="6" width="12" height="10" rx="1"/>' +
        '<line x1="4" y1="19" x2="20" y2="19"/>',
    ),
    imgRight: svg(
      '<rect x="12" y="5" width="9" height="9" rx="1"/>' +
        '<line x1="3" y1="7" x2="9" y2="7"/><line x1="3" y1="11" x2="9" y2="11"/>' +
        '<line x1="3" y1="18" x2="21" y2="18"/>',
    ),
    imgInline: svg(
      '<line x1="3" y1="5" x2="21" y2="5"/><rect x="9" y="9" width="6" height="6" rx="1"/>' +
        '<line x1="3" y1="18" x2="21" y2="18"/>',
    ),
  };

  var PALETTE = [
    "#000000",
    "#374151",
    "#6b7280",
    "#9ca3af",
    "#e5e7eb",
    "#ffffff",
    "#dc2626",
    "#ea580c",
    "#d97706",
    "#ca8a04",
    "#65a30d",
    "#16a34a",
    "#059669",
    "#0d9488",
    "#0891b2",
    "#2563eb",
    "#4f46e5",
    "#7c3aed",
    "#9333ea",
    "#db2777",
    "#e11d48",
    "#fecaca",
    "#fed7aa",
    "#fef08a",
    "#bbf7d0",
    "#a7f3d0",
    "#bae6fd",
    "#bfdbfe",
    "#c7d2fe",
    "#f5d0fe",
  ];

  // Membership test for base palette colors — anything else stored in the
  // color memory is a custom color picked with the OS picker.
  var PALETTE_SET = {};
  PALETTE.forEach(function (color) {
    PALETTE_SET[color] = 1;
  });

  // ------------------------------------------------------------------
  // Color usage memory
  //
  // Both color panels reorder themselves over time: every color the user
  // applies — from the palette or from the custom picker — is remembered
  // in localStorage and migrates to the front (most used first, then most
  // recent). Custom picker colors are kept as extra swatches so they can
  // be reused without opening the OS picker again. When localStorage is
  // unavailable (private mode, blocked storage) the memory degrades to a
  // per-page in-memory cache.
  // ------------------------------------------------------------------

  var COLOR_MEM_KEY = "simple-editor:color-usage";
  var COLOR_HEX_RE = /^#[0-9a-f]{6}$/;
  var MAX_CUSTOM_COLORS = 6;

  var colorMemory = (function () {
    var cache = null;
    var storageOk = true;

    function load() {
      if (cache) return cache;
      cache = { foreColor: [], hiliteColor: [] };
      var raw = null;
      try {
        raw = global.localStorage.getItem(COLOR_MEM_KEY);
      } catch (e) {
        storageOk = false; // no storage — keep the in-memory cache only
      }
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          ["foreColor", "hiliteColor"].forEach(function (prop) {
            if (!parsed || !Array.isArray(parsed[prop])) return;
            cache[prop] = parsed[prop].filter(function (e) {
              return (
                e &&
                COLOR_HEX_RE.test(e.c) &&
                typeof e.n === "number" &&
                isFinite(e.n) &&
                e.n > 0 &&
                typeof e.t === "number" &&
                isFinite(e.t)
              );
            });
          });
        } catch (e) {} // corrupted JSON — start from a clean cache
      }
      return cache;
    }

    function save() {
      if (!storageOk) return;
      try {
        global.localStorage.setItem(COLOR_MEM_KEY, JSON.stringify(cache));
      } catch (e) {
        storageOk = false;
      }
    }

    function record(prop, color) {
      var c = String(color).toLowerCase();
      if (!COLOR_HEX_RE.test(c)) return;

      var list = load()[prop];
      var entry = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].c === c) {
          entry = list[i];
          break;
        }
      }
      if (entry) {
        entry.n += 1;
        entry.t = Date.now();
      } else {
        list.push({ c: c, n: 1, t: Date.now() });
      }

      // Keep the memory bounded: beyond the base palette only a handful
      // of custom colors are kept, dropping the least used/oldest first.
      var customs = list.filter(function (e) {
        return !PALETTE_SET[e.c];
      });
      if (customs.length > MAX_CUSTOM_COLORS) {
        customs.sort(function (a, b) {
          return a.n - b.n || a.t - b.t;
        });
        var drop = {};
        customs
          .slice(0, customs.length - MAX_CUSTOM_COLORS)
          .forEach(function (e) {
            drop[e.c] = 1;
          });
        list = list.filter(function (e) {
          return !drop[e.c];
        });
        cache[prop] = list;
      }
      save();
    }

    // Display order for a panel: used colors first — most used, then
    // most recent — followed by the remaining base palette colors in
    // their original order.
    function order(prop) {
      var used = load()
        [prop].slice()
        .sort(function (a, b) {
          return b.n - a.n || b.t - a.t;
        });
      var seen = {};
      var out = [];
      used.forEach(function (e) {
        seen[e.c] = 1;
        out.push(e.c);
      });
      PALETTE.forEach(function (c) {
        if (!seen[c]) out.push(c);
      });
      return out;
    }

    return { record: record, order: order };
  })();

  // Label + input wrapper used by the modals.
  function field(labelText, input) {
    var wrap = document.createElement("div");
    wrap.className = "se-field";
    var label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function imgHTML(src, alt) {
    return (
      '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || "") + '">'
    );
  }

  // Context-menu input → CSS length: "320" → "320px", "100%" → "100%",
  // "" / "auto" → null (remove the property), anything else → false.
  function parseCssSize(raw) {
    var v = String(raw == null ? "" : raw)
      .trim()
      .toLowerCase();
    if (!v || v === "auto") return null;
    var m = /^(\d+(?:\.\d+)?)(px|%)?$/.exec(v);
    if (!m || Number(m[1]) === 0) return false;
    return m[1] + (m[2] || "px");
  }

  // Inline style value → context-menu input value: "auto" becomes ""
  // (the placeholder already says auto), anything else is kept as-is.
  function imgSizeValue(v) {
    v = String(v || "").trim();
    return v === "auto" ? "" : v;
  }

  function anchorHTML(href, text, newTab) {
    return (
      '<a href="' +
      escapeHtml(href) +
      '"' +
      (newTab ? ' target="_blank" rel="noopener noreferrer"' : "") +
      ">" +
      escapeHtml(text) +
      "</a>"
    );
  }

  // ------------------------------------------------------------------
  // Editor
  // ------------------------------------------------------------------

  function SimpleEditor(target, options) {
    if (typeof target === "string") {
      target = document.querySelector(target);
    }
    if (!target || !target.nodeType) {
      throw new Error("SimpleEditor: target element not found.");
    }
    if (!target.parentNode) {
      throw new Error("SimpleEditor: target must be inside the document.");
    }

    this.opts = merge(
      {
        language: "en",
        placeholder: "",
        content: null,
        uploadUrl: null,
        maxHeight: 0,
        strings: {},
      },
      options || {},
    );

    var dict = STRINGS[this.opts.language] || STRINGS.en;
    this.s = merge(merge({}, dict), this.opts.strings || {});
    if (!this.opts.placeholder) this.opts.placeholder = this.s.prompt;

    this._listeners = [];
    this._changeCbs = [];
    this._savedRange = null;
    this._sourceMode = false;
    this._openPanel = null;
    this._modal = null;
    this._destroyed = false;
    this._changePending = false;
    this._stateQueued = false;
    this._colorPanels = {};
    this._imgMenu = null;

    var isTextarea = target.tagName === "TEXTAREA";
    this._textarea = isTextarea ? target : null;
    this._orig = target;
    this._origParent = target.parentNode;

    var initial =
      this.opts.content != null
        ? this.opts.content
        : isTextarea
          ? target.value
          : target.innerHTML;

    this._build(String(initial || ""));
  }

  SimpleEditor.prototype = {
    constructor: SimpleEditor,

    // ----------------------------------------------------------------
    // DOM construction
    // ----------------------------------------------------------------

    _build: function (initialHtml) {
      var self = this;

      var root = (this.root = document.createElement("div"));
      root.className = "se-root";

      this.toolbar = document.createElement("div");
      this.toolbar.className = "se-toolbar";
      this.toolbar.setAttribute("role", "toolbar");
      this._buildToolbar();
      root.appendChild(this.toolbar);

      var body = document.createElement("div");
      body.className = "se-body";

      var content = (this.content = document.createElement("div"));
      content.className = "se-content";
      content.setAttribute("contenteditable", "true");
      content.setAttribute("spellcheck", "true");
      content.setAttribute("data-placeholder", this.opts.placeholder);
      if (this.opts.maxHeight) {
        content.style.maxHeight = this.opts.maxHeight + "px";
      }
      body.appendChild(content);

      // HTML source mode: a bar with Apply/Cancel + a code textarea.
      var sourceWrap = (this.sourceWrap = document.createElement("div"));
      sourceWrap.className = "se-source-wrap";
      sourceWrap.hidden = true;

      var bar = document.createElement("div");
      bar.className = "se-source-bar";
      var tag = document.createElement("span");
      tag.className = "se-tag";
      tag.textContent = "HTML";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "se-mini-btn";
      cancelBtn.textContent = this.s.cancel;
      var applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "se-mini-btn se-mini-btn-primary";
      applyBtn.textContent = this.s.apply;
      bar.appendChild(tag);
      bar.appendChild(cancelBtn);
      bar.appendChild(applyBtn);

      var ta = (this.sourceArea = document.createElement("textarea"));
      ta.className = "se-source";

      sourceWrap.appendChild(bar);
      sourceWrap.appendChild(ta);
      body.appendChild(sourceWrap);

      root.appendChild(body);

      // Insert the editor where the target was.
      this._origParent.insertBefore(root, this._orig);
      if (this._textarea) this._textarea.classList.add("se-hidden");
      else this._origParent.removeChild(this._orig);

      // ---- events ----
      this._listen(this.toolbar, "mousedown", function (e) {
        self._toolbarMousedown(e);
      });
      this._listen(this.toolbar, "click", function (e) {
        self._toolbarClick(e);
      });
      this._listen(content, "input", function () {
        self._onInput();
      });
      this._listen(content, "keydown", function (e) {
        self._onKeydown(e);
      });
      this._listen(content, "paste", function (e) {
        self._onPaste(e);
      });
      this._listen(content, "dragover", function (e) {
        e.preventDefault();
      });
      this._listen(content, "drop", function (e) {
        self._onDrop(e);
      });
      this._listen(content, "mousemove", function (e) {
        self._onTableHover(e);
      });
      this._listen(content, "mousedown", function (e) {
        self._onContentMousedown(e);
      });
      this._listen(content, "contextmenu", function (e) {
        self._onContextMenu(e);
      });
      this._listen(content, "dblclick", function (e) {
        self._onImgDblclick(e);
      });
      this._listen(content, "mouseleave", function () {
        self.content.style.cursor = "";
        self._clearColHint();
      });
      this._listen(document, "selectionchange", function () {
        self._onDocSelectionChange();
      });
      this._listen(document, "mousedown", function (e) {
        self._onDocMousedown(e);
      });
      this._listen(applyBtn, "click", function () {
        self._applySource();
      });
      this._listen(cancelBtn, "click", function () {
        self._toggleSource(false);
      });

      // Prefer real <p> paragraphs for Enter.
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {}

      this.setHTML(initialHtml, { silent: true });
      this._updatePlaceholder();
      this._updateToolbar();
    },

    _buildToolbar: function () {
      var s = this.s;
      var defs = [
        { dd: "block", title: s.blockFormat },
        { sep: true },
        {
          cmd: "bold",
          html: '<span class="se-glyph se-glyph-b">B</span>',
          title: s.bold,
        },
        {
          cmd: "italic",
          html: '<span class="se-glyph se-glyph-i">I</span>',
          title: s.italic,
        },
        {
          cmd: "underline",
          html: '<span class="se-glyph se-glyph-u">U</span>',
          title: s.underline,
        },
        { sep: true },
        { cmd: "insertUnorderedList", icon: "listUl", title: s.listBullets },
        { cmd: "insertOrderedList", icon: "listOl", title: s.listNumbers },
        { sep: true },
        {
          dd: "color",
          prop: "foreColor",
          icon: "textColor",
          title: s.textColor,
        },
        { dd: "color", prop: "hiliteColor", icon: "bgColor", title: s.bgColor },
        { sep: true },
        { act: "link", icon: "link", title: s.link },
        { act: "unlink", icon: "unlink", title: s.unlink },
        { sep: true },
        { act: "image", icon: "image", title: s.image },
        { act: "table", icon: "table", title: s.table },
        { cmd: "insertHorizontalRule", icon: "hr", title: s.horizontalRule },
        { sep: true },
        { act: "source", icon: "code", title: s.source },
        { sep: true },
        { cmd: "undo", icon: "undo", title: s.undo },
        { cmd: "redo", icon: "redo", title: s.redo },
      ];

      this._toolbarBtns = [];

      defs.forEach(function (def) {
        if (def.sep) {
          var sep = document.createElement("div");
          sep.className = "se-sep";
          this.toolbar.appendChild(sep);
          return;
        }
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "se-btn";
        if (def.title) {
          btn.title = def.title;
          btn.setAttribute("aria-label", def.title);
        }
        if (def.icon) btn.innerHTML = ICONS[def.icon];
        if (def.html) btn.innerHTML = def.html;

        if (def.dd === "block") {
          btn.classList.add("se-block-btn");
          btn.innerHTML = "";
          var label = document.createElement("span");
          label.className = "se-block-label";
          label.textContent = this.s.paragraph;
          var caret = document.createElement("span");
          caret.className = "se-caret";
          caret.innerHTML = ICONS.caret;
          btn.appendChild(label);
          btn.appendChild(caret);
          this._blockLabel = label;
        }
        if (def.act === "source") {
          btn.classList.add("se-btn-source");
          this._sourceBtn = btn;
        }

        btn._seDef = def;
        this._toolbarBtns.push(btn);
        this.toolbar.appendChild(btn);
      }, this);
    },

    // ----------------------------------------------------------------
    // Toolbar interaction
    // ----------------------------------------------------------------

    _toolbarMousedown: function (e) {
      // Keep the caret/selection inside the editor while pressing toolbar
      // buttons so execCommand applies to the right range. Inputs inside
      // dropdown panels still need their default behaviour.
      if (e.target.closest("input, textarea, select")) return;
      e.preventDefault();
    },

    _toolbarClick: function (e) {
      var btn = e.target.closest(".se-btn");
      if (!btn) return;
      var def = btn._seDef;
      if (!def) return;

      if (def.dd === "block") {
        this._togglePanel(this._getBlockPanel(), btn);
      } else if (def.dd === "color") {
        // Rebuild the swatches on every open so they reflect usage.
        var panel = this._getColorPanel(def.prop);
        this._renderColorGrid(def.prop);
        this._togglePanel(panel, btn);
      } else if (def.cmd) {
        this._exec(def.cmd);
      } else if (def.act === "link") {
        this._linkModal();
      } else if (def.act === "unlink") {
        this._unlink();
      } else if (def.act === "image") {
        this._imageModal();
      } else if (def.act === "table") {
        this._tableModal();
      } else if (def.act === "source") {
        this._toggleSource();
      }
    },

    _getBlockPanel: function () {
      if (this._blockPanel) return this._blockPanel;
      var self = this;
      var panel = document.createElement("div");
      panel.className = "se-panel se-panel-block";
      panel.hidden = true;

      [
        ["p", this.s.paragraph, ""],
        ["h1", this.s.heading1, "se-opt-h1"],
        ["h2", this.s.heading2, "se-opt-h2"],
        ["h3", this.s.heading3, "se-opt-h3"],
        ["h4", this.s.heading4, "se-opt-h4"],
      ].forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button";
        if (o[2]) b.className = o[2];
        b.textContent = o[1];
        b._seTag = o[0];
        b.addEventListener("click", function () {
          self._setBlock(o[0]);
          self._closePanel();
        });
        panel.appendChild(b);
      });

      this.toolbar.appendChild(panel);
      this._blockPanel = panel;
      return panel;
    },

    _getColorPanel: function (prop) {
      if (this._colorPanels[prop]) return this._colorPanels[prop];
      var self = this;
      var panel = document.createElement("div");
      panel.className = "se-panel se-panel-color";
      panel.hidden = true;

      var grid = document.createElement("div");
      grid.className = "se-colors";
      panel.appendChild(grid);
      panel._grid = grid;

      var custom = document.createElement("label");
      custom.className = "se-custom";
      var picker = document.createElement("input");
      picker.type = "color";
      picker.value = "#2563eb";
      var lbl = document.createElement("span");
      lbl.textContent = this.s.customColor;
      custom.appendChild(picker);
      custom.appendChild(lbl);
      picker.addEventListener("change", function () {
        colorMemory.record(prop, picker.value);
        self._exec(prop, picker.value);
        self._closePanel();
      });
      panel.appendChild(custom);

      this.toolbar.appendChild(panel);
      this._colorPanels[prop] = panel;
      return panel;
    },

    // Rebuilds a color panel's swatches: remembered colors first (most
    // used, then most recent), the untouched base palette after them.
    // Called on every open so the order tracks actual usage.
    _renderColorGrid: function (prop) {
      var self = this;
      var panel = this._colorPanels[prop];
      if (!panel || !panel._grid) return;
      var grid = panel._grid;
      grid.innerHTML = "";
      colorMemory.order(prop).forEach(function (color) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "se-swatch";
        b.title = color;
        b.style.background = color;
        b.addEventListener("click", function () {
          colorMemory.record(prop, color);
          self._exec(prop, color);
          self._closePanel();
        });
        grid.appendChild(b);
      });
    },

    _togglePanel: function (panel, btn) {
      if (panel.hidden) {
        this._closePanel();
        panel.hidden = false;
        var left = btn.offsetLeft;
        var maxLeft = this.toolbar.clientWidth - panel.offsetWidth - 4;
        panel.style.left = Math.max(0, Math.min(left, maxLeft)) + "px";
        this._openPanel = panel;
      } else {
        this._closePanel();
      }
    },

    _closePanel: function () {
      if (this._openPanel) {
        this._openPanel.hidden = true;
        this._openPanel = null;
      }
    },

    _onDocMousedown: function (e) {
      if (this._openPanel && !this.toolbar.contains(e.target))
        this._closePanel();
      if (this._imgMenu && !this._imgMenu.el.contains(e.target))
        this._closeImageMenu();
    },

    // ----------------------------------------------------------------
    // Commands & selection
    // ----------------------------------------------------------------

    _exec: function (cmd, value) {
      if (this._destroyed) return;
      this.content.focus();
      if (this._savedRange) this._restoreRange();

      var ok = false;
      try {
        ok = document.execCommand(
          cmd,
          false,
          value !== undefined ? value : null,
        );
      } catch (e) {
        ok = false;
      }

      // Older engines want formatBlock values like "<H2>".
      if (!ok && cmd === "formatBlock" && typeof value === "string") {
        try {
          document.execCommand(cmd, false, "<" + value.toUpperCase() + ">");
        } catch (e) {}
      }
      // Some engines only support backColor instead of hiliteColor.
      if (!ok && cmd === "hiliteColor" && typeof value === "string") {
        try {
          document.execCommand("backColor", false, value);
        } catch (e) {}
      }

      this._savedRange = null;
      this._updateToolbar();
      this._updatePlaceholder();
      this._emitChange();
    },

    _saveRange: function () {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var r = sel.getRangeAt(0);
      var node = r.commonAncestorContainer;
      var el = node.nodeType === 1 ? node : node.parentNode;
      if (el && this.content.contains(el)) {
        this._savedRange = r.cloneRange();
      }
    },

    _restoreRange: function () {
      var r = this._savedRange;
      if (!r) return;
      var sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      try {
        sel.addRange(r);
      } catch (e) {}
    },

    _currentBlock: function () {
      var v = "";
      try {
        v = String(
          document.queryCommandValue("formatBlock") || "",
        ).toLowerCase();
      } catch (e) {
        v = "";
      }
      if (v === "h1" || v === "h2" || v === "h3" || v === "h4") return v;
      return "p";
    },

    _setBlock: function (tag) {
      // Clicking the current heading again returns to a paragraph.
      var target = tag !== "p" && this._currentBlock() === tag ? "p" : tag;
      this._exec("formatBlock", target);
    },

    _unlink: function () {
      // For a collapsed caret inside a link, select the whole link first
      // so the command has a range to work on.
      var sel = window.getSelection();
      var node = sel && sel.anchorNode;
      var el = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
      var a = el && el.closest ? el.closest("a") : null;
      if (a && this.content.contains(a)) {
        var r = document.createRange();
        r.selectNodeContents(a);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      this._exec("unlink");
      // Rare fallback if the command was refused by the engine.
      node = sel && sel.anchorNode;
      el = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
      a = el && el.closest ? el.closest("a") : null;
      if (a && this.content.contains(a)) unwrap(a);
    },

    // ----------------------------------------------------------------
    // State updates
    // ----------------------------------------------------------------

    _updateToolbar: function () {
      var self = this;
      this._toolbarBtns.forEach(function (btn) {
        var def = btn._seDef;
        if (!def || !def.cmd) return;
        if (
          def.cmd === "bold" ||
          def.cmd === "italic" ||
          def.cmd === "underline" ||
          def.cmd === "insertUnorderedList" ||
          def.cmd === "insertOrderedList"
        ) {
          var active = false;
          if (!self._sourceMode) {
            try {
              active = document.queryCommandState(def.cmd);
            } catch (e) {
              active = false;
            }
          }
          btn.classList.toggle("se-active", !!active);
        }
      });

      var cur = this._currentBlock();
      var labels = {
        p: this.s.paragraph,
        h1: this.s.heading1,
        h2: this.s.heading2,
        h3: this.s.heading3,
        h4: this.s.heading4,
      };
      if (this._blockLabel)
        this._blockLabel.textContent = labels[cur] || this.s.paragraph;

      if (this._blockPanel) {
        Array.prototype.forEach.call(this._blockPanel.children, function (b) {
          b.classList.toggle("se-active", b._seTag === cur);
        });
      }
      if (this._sourceBtn) {
        this._sourceBtn.classList.toggle("se-active", this._sourceMode);
      }
    },

    _onDocSelectionChange: function () {
      if (this._destroyed || this._sourceMode) return;
      var sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;
      if (!this.content.contains(sel.anchorNode)) return;
      if (this._stateQueued) return;
      var self = this;
      this._stateQueued = true;
      window.requestAnimationFrame(function () {
        self._stateQueued = false;
        if (!self._destroyed) self._updateToolbar();
      });
    },

    _isEmpty: function () {
      if (this.content.textContent.trim()) return false;
      return !this.content.querySelector("img, table, hr");
    },

    _updatePlaceholder: function () {
      this.content.classList.toggle("se-placeholder", this._isEmpty());
    },

    _onInput: function () {
      this._updatePlaceholder();
      this._emitChange();
    },

    _onKeydown: function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        this._linkModal();
        return;
      }
      // Ctrl/Cmd+Alt+1..4 turn the current block into a heading, and
      // Ctrl/Cmd+Alt+0 returns it to a paragraph (same convention as
      // Google Docs / Word). Uses e.code so any keyboard layout works.
      if (!this._sourceMode && (e.ctrlKey || e.metaKey) && e.altKey) {
        var m = /^Digit([0-4])$/.exec(e.code || "");
        if (m) {
          e.preventDefault();
          this._setBlock(["p", "h1", "h2", "h3", "h4"][Number(m[1])]);
          return;
        }
      }
      if (e.key === "Tab") this._onListTab(e);
    },

    // Tab / Shift+Tab inside a list indents / outdents the current item,
    // producing nested <ul>/<ol> structures. Outside a list, Tab keeps
    // its default focus behaviour.
    _onListTab: function (e) {
      if (this._sourceMode) return;
      var sel = window.getSelection();
      var node = sel && sel.anchorNode;
      var el = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
      var li = el && el.closest ? el.closest("li") : null;
      if (!li || !this.content.contains(li)) return;
      e.preventDefault();
      this._exec(e.shiftKey ? "outdent" : "indent");
    },

    // ----------------------------------------------------------------
    // Paste & drop
    // ----------------------------------------------------------------

    _onPaste: function (e) {
      if (this._sourceMode) return;
      var dt = e.clipboardData;
      if (!dt) return;
      var self = this;

      // Pasted image files (e.g. screenshots).
      var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
          var file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            this._insertImageFile(file).then(
              function (url) {
                self._exec("insertHTML", imgHTML(url, ""));
              },
              function () {},
            );
            return;
          }
        }
      }

      var html = dt.getData("text/html");
      var plain = dt.getData("text/plain");
      e.preventDefault();

      if (html) {
        var clean = cleanHTMLString(html);
        if (clean && clean.replace(/<br\s*\/?>/gi, "").trim()) {
          this._exec("insertHTML", clean);
        }
      } else if (plain) {
        var asHtml = textToHTML(plain);
        if (asHtml) this._exec("insertHTML", asHtml);
      }
    },

    _onDrop: function (e) {
      if (this._sourceMode) return;
      e.preventDefault();
      var dt = e.dataTransfer;
      if (!dt) return;
      var self = this;

      var file = dt.files && dt.files[0];
      if (file && /^image\//.test(file.type)) {
        this._insertImageFile(file).then(
          function (url) {
            self._exec("insertHTML", imgHTML(url, ""));
          },
          function () {},
        );
        return;
      }

      var html = dt.getData("text/html");
      if (html) {
        var clean = cleanHTMLString(html);
        if (clean) this._exec("insertHTML", clean);
        return;
      }
      var text = dt.getData("text/plain");
      if (text) {
        var asHtml = textToHTML(text);
        if (asHtml) this._exec("insertHTML", asHtml);
      }
    },

    // ----------------------------------------------------------------
    // Table column resizing
    // ----------------------------------------------------------------

    _onTableHover: function (e) {
      if (this._destroyed || this._sourceMode) return;
      if (this._colDrag) return;
      // Ignore hover while the user is dragging a text selection.
      if (e.buttons) {
        this.content.style.cursor = "";
        this._clearColHint();
        return;
      }
      var hit = this._borderHit(e);
      if (hit) {
        this.content.style.cursor = "col-resize";
        this._showColHint(hit);
      } else {
        this.content.style.cursor = "";
        this._clearColHint();
      }
    },

    // Returns the internal column border under the pointer, if any.
    _borderHit: function (e) {
      var el = e.target;
      if (!el || !el.closest) return null;
      var cell = el.closest("td, th");
      if (!cell || !this.content.contains(cell)) return null;
      var table = cell.closest("table");
      if (!table || !this.content.contains(table)) return null;
      var row = table.rows && table.rows[0];
      if (!row || row.cells.length < 2) return null;
      for (var i = 0; i < row.cells.length - 1; i++) {
        var right = row.cells[i].getBoundingClientRect().right;
        if (Math.abs(e.clientX - right) <= 6) {
          return { table: table, index: i };
        }
      }
      return null;
    },

    _showColHint: function (hit) {
      var cell = hit.table.rows[0].cells[hit.index];
      if (this._hintCell === cell) return;
      this._clearColHint();
      this._hintCell = cell;
      cell.style.borderRight = "2px solid var(--se-accent)";
    },

    _clearColHint: function () {
      if (this._hintCell) {
        this._hintCell.style.borderRight = "";
        this._hintCell = null;
      }
    },

    _onContentMousedown: function (e) {
      if (this._destroyed || this._sourceMode) return;
      var hit = this._borderHit(e);
      if (!hit) return;
      e.preventDefault();
      this._clearColHint();
      this._startColDrag(hit, e);
    },

    _startColDrag: function (hit, e) {
      var self = this;
      var table = hit.table;
      var row = table.rows[0];
      // Resizing relies on a 1:1 mapping between first-row cells and
      // columns; tables using colspan keep their browser-assigned widths.
      if (row.cells.length !== this._columnCount(table)) return;

      var cols = this._ensureCols(table, row.cells.length);
      if (!cols || cols.length < 2) return;

      var widths = [];
      for (var i = 0; i < row.cells.length; i++) {
        widths.push(row.cells[i].getBoundingClientRect().width);
      }
      var total = table.getBoundingClientRect().width;
      if (!total || total < 20) return;

      // Snapshot every column in px so the dragged border follows the
      // cursor exactly (fixed layout would otherwise redistribute space).
      for (var s = 0; s < cols.length; s++) {
        cols[s].style.width = widths[s] + "px";
      }

      var idx = hit.index;
      var leftW = widths[idx];
      var rightW = widths[idx + 1];
      var MIN = 24;
      var startX = e.clientX;
      var prevCursor = document.body.style.cursor;
      var prevSelect = document.body.style.userSelect;

      function onMove(ev) {
        var nl = leftW + (ev.clientX - startX);
        if (nl < MIN) nl = MIN;
        if (nl > leftW + rightW - MIN) nl = leftW + rightW - MIN;
        cols[idx].style.width = nl + "px";
        cols[idx + 1].style.width = leftW + rightW - nl + "px";
      }

      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
        self.content.style.cursor = "";
        self._colDrag = null;

        // Commit as percentages of the table width: the table keeps
        // width: 100% and the proportions hold at every viewport.
        var sum = 0;
        var pcts = [];
        for (var i = 0; i < cols.length; i++) {
          var px = parseFloat(cols[i].style.width) || widths[i];
          var pct = Math.round((px / total) * 10000) / 100;
          pcts.push(pct);
          sum += pct;
        }
        pcts[pcts.length - 1] =
          Math.round((pcts[pcts.length - 1] + (100 - sum)) * 100) / 100;
        for (var j = 0; j < cols.length; j++) {
          cols[j].style.width = pcts[j] + "%";
        }

        self._savedRange = null;
        self._emitChange();
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      this.content.style.cursor = "col-resize";
      this._colDrag = { onMove: onMove, onUp: onUp };
    },

    _columnCount: function (table) {
      var max = 0;
      for (var r = 0; r < table.rows.length; r++) {
        var w = 0;
        for (var c = 0; c < table.rows[r].cells.length; c++) {
          w += parseInt(table.rows[r].cells[c].colSpan, 10) || 1;
        }
        if (w > max) max = w;
      }
      return max;
    },

    // Column widths live on <col> elements inside a <colgroup>, so the
    // td/th markup itself stays untouched.
    _ensureCols: function (table, count) {
      var colgroup = null;
      for (var i = 0; i < table.children.length; i++) {
        if (table.children[i].tagName === "COLGROUP") {
          colgroup = table.children[i];
          break;
        }
      }
      if (!colgroup) {
        colgroup = document.createElement("colgroup");
        table.insertBefore(colgroup, table.firstChild);
      }
      while (colgroup.children.length < count) {
        colgroup.appendChild(document.createElement("col"));
      }
      while (colgroup.children.length > count) {
        colgroup.removeChild(colgroup.lastChild);
      }
      return Array.prototype.slice.call(colgroup.children);
    },

    _cancelColDrag: function () {
      var d = this._colDrag;
      if (!d) return;
      document.removeEventListener("mousemove", d.onMove);
      document.removeEventListener("mouseup", d.onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      this.content.style.cursor = "";
      this._colDrag = null;
    },

    // ----------------------------------------------------------------
    // Image context menu (right-click / double-click on an image)
    // ----------------------------------------------------------------

    _onContextMenu: function (e) {
      if (this._destroyed || this._sourceMode) return;
      var el = e.target;
      var img = el && el.closest ? el.closest("img") : null;
      if (!img || !this.content.contains(img)) {
        this._closeImageMenu();
        return;
      }
      e.preventDefault();
      this._openImageMenu(img, e.clientX, e.clientY);
    },

    _onImgDblclick: function (e) {
      if (this._destroyed || this._sourceMode) return;
      var el = e.target;
      var img = el && el.closest ? el.closest("img") : null;
      if (!img || !this.content.contains(img)) return;
      this._openImageMenu(img, e.clientX, e.clientY);
    },

    // Current alignment of an image, derived from its inline style:
    // "left" | "right" | "center" | "inline".
    _imgAlign: function (img) {
      var st = img.style;
      var float = st.getPropertyValue("float");
      if (float === "left") return "left";
      if (float === "right") return "right";
      if (
        st.getPropertyValue("display") === "block" &&
        (st.getPropertyValue("margin-left") === "auto" ||
          st.getPropertyValue("margin-right") === "auto")
      ) {
        return "center";
      }
      return "inline";
    },

    _setImgAlign: function (img, align) {
      var st = img.style;
      ["float", "display", "margin", "margin-left", "margin-right"].forEach(
        function (p) {
          st.removeProperty(p);
        },
      );
      if (align === "left") {
        st.setProperty("float", "left");
        st.setProperty("margin", "0 1em 1em 0");
      } else if (align === "right") {
        st.setProperty("float", "right");
        st.setProperty("margin", "0 0 1em 1em");
      } else if (align === "center") {
        st.setProperty("display", "block");
        st.setProperty("margin-left", "auto");
        st.setProperty("margin-right", "auto");
      }
    },

    _setImgSize: function (img, w, h) {
      var st = img.style;
      st.removeProperty("width");
      st.removeProperty("height");
      if (w) st.setProperty("width", w);
      if (h) st.setProperty("height", h);
      // A width without an explicit height gets height: auto so the
      // aspect ratio survives on pages that do not ship the editor CSS.
      if (w && !h) st.setProperty("height", "auto");
    },

    _openImageMenu: function (img, x, y) {
      var s = this.s;
      var self = this;
      this._closeImageMenu();
      if (!img.parentNode || !this.content.contains(img)) return;

      function alive() {
        return !!(img.parentNode && self.content.contains(img));
      }

      var menu = document.createElement("div");
      menu.className = "se-ctxmenu";
      menu.setAttribute("role", "dialog");
      menu.setAttribute("aria-label", s.imageProps);
      this._copyThemeVars(menu);

      var wInput = document.createElement("input");
      wInput.type = "text";
      wInput.placeholder = "auto";
      wInput.value = imgSizeValue(img.style.getPropertyValue("width"));

      var hInput = document.createElement("input");
      hInput.type = "text";
      hInput.placeholder = "auto";
      hInput.value = imgSizeValue(img.style.getPropertyValue("height"));

      var err = document.createElement("p");
      err.className = "se-error";

      var hint = document.createElement("p");
      hint.className = "se-hint";
      hint.textContent = s.imageSizeHint;

      var applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "se-btn-primary se-ctx-apply";
      applyBtn.textContent = s.apply;

      var alignRow = document.createElement("div");
      alignRow.className = "se-align-row";
      var alignBtns = {};

      function refreshAlign() {
        var cur = self._imgAlign(img);
        Object.keys(alignBtns).forEach(function (k) {
          alignBtns[k].classList.toggle("se-active", k === cur);
        });
      }

      [
        ["left", "imgLeft", s.alignLeft],
        ["center", "imgCenter", s.alignCenter],
        ["right", "imgRight", s.alignRight],
        ["inline", "imgInline", s.alignInline],
      ].forEach(function (o) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "se-btn";
        b.title = o[2];
        b.setAttribute("aria-label", o[2]);
        b.innerHTML = ICONS[o[1]];
        b.addEventListener("click", function () {
          if (!alive()) {
            close();
            return;
          }
          self._setImgAlign(img, o[0]);
          refreshAlign();
          self._emitChange();
        });
        alignBtns[o[0]] = b;
        alignRow.appendChild(b);
      });

      var sizeRow = document.createElement("div");
      sizeRow.className = "se-row";
      sizeRow.appendChild(field(s.imageWidth, wInput));
      sizeRow.appendChild(field(s.imageHeight, hInput));

      var sep = document.createElement("div");
      sep.className = "se-ctx-sep";

      menu.appendChild(sizeRow);
      menu.appendChild(hint);
      menu.appendChild(err);
      menu.appendChild(applyBtn);
      menu.appendChild(sep);
      menu.appendChild(alignRow);
      document.body.appendChild(menu);

      // Clamp the menu into the viewport.
      var left = Math.max(
        8,
        Math.min(x, window.innerWidth - menu.offsetWidth - 8),
      );
      var top = Math.max(
        8,
        Math.min(y, window.innerHeight - menu.offsetHeight - 8),
      );
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      function close() {
        if (!menu.parentNode) return;
        menu.parentNode.removeChild(menu);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("scroll", onScroll, true);
        self._imgMenu = null;
      }
      function onKey(e) {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }
      function onScroll() {
        close();
      }
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onScroll, true);

      function apply() {
        if (!alive()) {
          close();
          return;
        }
        var w = parseCssSize(wInput.value);
        var h = parseCssSize(hInput.value);
        if (w === false || h === false) {
          err.textContent = s.invalidSize;
          (w === false ? wInput : hInput).focus();
          return;
        }
        close();
        self._setImgSize(img, w, h);
        self._emitChange();
      }
      applyBtn.addEventListener("click", apply);
      [wInput, hInput].forEach(function (inp) {
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        });
      });

      refreshAlign();
      this._imgMenu = { el: menu, close: close };
      wInput.focus();
      wInput.select();
    },

    _closeImageMenu: function () {
      if (this._imgMenu) this._imgMenu.close();
    },

    // ----------------------------------------------------------------
    // Modals
    // ----------------------------------------------------------------

    // Body-level popups (modals, the image menu) sit outside .se-root
    // and cannot inherit its custom properties — copy the computed theme
    // onto them so per-instance theming still applies.
    _copyThemeVars: function (el) {
      var rootStyle = window.getComputedStyle(this.root);
      CSS_VARS.forEach(function (name) {
        var value = rootStyle.getPropertyValue(name);
        if (value) el.style.setProperty(name, value);
      });
    },

    _openModal: function (opts) {
      var self = this;
      this._saveRange();
      if (this._modal) this._modal.close();

      var overlay = document.createElement("div");
      overlay.className = "se-overlay";
      this._copyThemeVars(overlay);

      var form = document.createElement("form");
      form.className = "se-modal";
      form.noValidate = true;

      var head = document.createElement("div");
      head.className = "se-modal-head";
      var title = document.createElement("span");
      title.textContent = opts.title;
      var x = document.createElement("button");
      x.type = "button";
      x.className = "se-modal-x";
      x.setAttribute("aria-label", this.s.close);
      x.textContent = "×";
      head.appendChild(title);
      head.appendChild(x);

      var body = document.createElement("div");
      body.className = "se-modal-body";
      opts.build(body);

      var foot = document.createElement("div");
      foot.className = "se-modal-foot";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "se-btn-ghost";
      cancelBtn.textContent = this.s.cancel;
      var primaryBtn = document.createElement("button");
      primaryBtn.type = "submit";
      primaryBtn.className = "se-btn-primary";
      primaryBtn.textContent = opts.primaryLabel || this.s.insert;
      foot.appendChild(cancelBtn);
      foot.appendChild(primaryBtn);

      form.appendChild(head);
      form.appendChild(body);
      form.appendChild(foot);
      overlay.appendChild(form);
      document.body.appendChild(overlay);

      function close() {
        if (!overlay.parentNode) return;
        overlay.parentNode.removeChild(overlay);
        document.removeEventListener("keydown", onKey);
        self._modal = null;
      }
      function cancel() {
        close();
        self._savedRange = null;
      }
      function onKey(e) {
        if (e.key === "Escape") {
          e.stopPropagation();
          cancel();
        }
      }

      x.addEventListener("click", cancel);
      cancelBtn.addEventListener("click", cancel);
      overlay.addEventListener("mousedown", function (e) {
        if (e.target === overlay) cancel();
      });
      document.addEventListener("keydown", onKey);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        opts.onSubmit(close, primaryBtn);
      });

      this._modal = { close: close };

      var first = form.querySelector(
        'input:not([type="checkbox"]):not([type="file"]), textarea',
      );
      if (first) first.focus();
    },

    _linkModal: function () {
      var s = this.s;
      var self = this;
      var sel = window.getSelection();
      var selText = sel ? sel.toString() : "";

      var urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.placeholder = "https://…";

      var textInput = document.createElement("input");
      textInput.type = "text";
      textInput.value = selText;
      // Kept to detect whether the user left the prefilled text alone.
      var initialText = textInput.value;

      var newTab = document.createElement("input");
      newTab.type = "checkbox";

      var err = document.createElement("p");
      err.className = "se-error";

      this._openModal({
        title: s.link,
        primaryLabel: s.insert,
        build: function (body) {
          body.appendChild(field(s.url, urlInput));
          body.appendChild(field(s.linkText, textInput));
          var chk = document.createElement("label");
          chk.className = "se-check";
          chk.appendChild(newTab);
          var lbl = document.createElement("span");
          lbl.textContent = s.openNewTab;
          chk.appendChild(lbl);
          body.appendChild(chk);
          body.appendChild(err);
        },
        onSubmit: function (close) {
          var raw = urlInput.value.trim();
          var safe = safeUrl(raw, false);
          if (!safe) {
            err.textContent = s.invalidUrl;
            urlInput.focus();
            return;
          }
          var text = textInput.value.trim() || safe;
          // Left untouched with a non-empty selection: link the selection
          // in place via createLink so formatting on it (bold, underline,
          // colors, ...) survives. Changing the text replaces the
          // selection with a fresh plain link instead.
          var unchanged = textInput.value === initialText;
          close();
          if (unchanged && selText.trim()) {
            self._linkSelection(safe, newTab.checked, selText);
          } else {
            self._exec("insertHTML", anchorHTML(safe, text, newTab.checked));
          }
        },
      });
    },

    // Links the saved selection in place with the native createLink
    // command — unlike insertHTML it wraps the existing nodes instead of
    // replacing them with plain text, so formatting on the selected text
    // (bold, underline, colors, ...) is kept and partial selections are
    // split correctly. Falls back to a plain-text link if the engine
    // refuses the command.
    _linkSelection: function (url, newTab, fallbackText) {
      if (this._destroyed) return;
      this.content.focus();
      if (this._savedRange) this._restoreRange();

      var ok = false;
      try {
        ok = document.execCommand("createLink", false, url);
      } catch (e) {
        ok = false;
      }

      if (!ok) {
        this._exec("insertHTML", anchorHTML(url, fallbackText, newTab));
        return;
      }

      // createLink cannot set target/rel — patch it onto the anchors the
      // fresh selection covers.
      if (newTab) this._markLinksInSelection();

      this._savedRange = null;
      this._updateToolbar();
      this._updatePlaceholder();
      this._emitChange();
    },

    // Sets target="_blank" + rel on every anchor the current selection
    // touches (handles multi-block selections, where createLink produces
    // one anchor per block).
    _markLinksInSelection: function () {
      var sel = window.getSelection();
      if (!sel) return;
      var range = sel.rangeCount ? sel.getRangeAt(0) : null;
      var closestA = function (node) {
        var el = node ? (node.nodeType === 1 ? node : node.parentNode) : null;
        return el && el.closest ? el.closest("a") : null;
      };
      var edge = [closestA(sel.anchorNode), closestA(sel.focusNode)];
      Array.prototype.forEach.call(
        this.content.querySelectorAll("a"),
        function (a) {
          var hit = edge.indexOf(a) !== -1;
          if (!hit && range) {
            try {
              hit = range.intersectsNode(a);
            } catch (e) {
              hit = false;
            }
          }
          if (hit) {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
          }
        },
      );
    },

    _imageModal: function () {
      var s = this.s;
      var self = this;

      var urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.placeholder = "https://…";

      var altInput = document.createElement("input");
      altInput.type = "text";

      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";

      var fileLabel = document.createElement("label");
      fileLabel.className = "se-file";
      var labelText = document.createElement("span");
      labelText.textContent = s.chooseFile;
      fileLabel.appendChild(fileInput);
      fileLabel.appendChild(labelText);
      fileInput.addEventListener("change", function () {
        labelText.textContent =
          fileInput.files && fileInput.files[0]
            ? fileInput.files[0].name
            : s.chooseFile;
      });

      var err = document.createElement("p");
      err.className = "se-error";

      this._openModal({
        title: s.image,
        primaryLabel: s.insert,
        build: function (body) {
          body.appendChild(field(s.url, urlInput));
          body.appendChild(field(s.altText, altInput));
          body.appendChild(fileLabel);
          if (!self.opts.uploadUrl) {
            var hint = document.createElement("p");
            hint.className = "se-hint";
            hint.textContent = s.base64Hint;
            body.appendChild(hint);
          }
          body.appendChild(err);
        },
        onSubmit: function (close, primaryBtn) {
          var alt = altInput.value.trim();
          var file = fileInput.files && fileInput.files[0];

          if (file) {
            if (!/^image\//.test(file.type)) {
              err.textContent = s.invalidImage;
              return;
            }
            primaryBtn.disabled = true;
            primaryBtn.textContent = s.uploading;
            self._insertImageFile(file).then(
              function (url) {
                close();
                self._exec("insertHTML", imgHTML(url, alt));
              },
              function () {
                primaryBtn.disabled = false;
                primaryBtn.textContent = s.insert;
                err.textContent = s.uploadFailed;
              },
            );
            return;
          }

          var raw = urlInput.value.trim();
          if (!raw) {
            err.textContent = s.urlOrFile;
            return;
          }
          var safe = safeUrl(raw, true);
          if (!safe) {
            err.textContent = s.invalidUrl;
            return;
          }
          close();
          self._exec("insertHTML", imgHTML(safe, alt));
        },
      });
    },

    _tableModal: function () {
      var s = this.s;
      var self = this;

      var rows = document.createElement("input");
      rows.type = "number";
      rows.min = "1";
      rows.max = "50";
      rows.value = "3";

      var cols = document.createElement("input");
      cols.type = "number";
      cols.min = "1";
      cols.max = "50";
      cols.value = "3";

      var header = document.createElement("input");
      header.type = "checkbox";
      header.checked = true;

      this._openModal({
        title: s.table,
        primaryLabel: s.insert,
        build: function (body) {
          var row = document.createElement("div");
          row.className = "se-row";
          row.appendChild(field(s.rows, rows));
          row.appendChild(field(s.columns, cols));
          body.appendChild(row);
          var chk = document.createElement("label");
          chk.className = "se-check";
          chk.appendChild(header);
          var lbl = document.createElement("span");
          lbl.textContent = s.headerRow;
          chk.appendChild(lbl);
          body.appendChild(chk);
        },
        onSubmit: function (close) {
          var r = Math.min(50, Math.max(1, parseInt(rows.value, 10) || 3));
          var c = Math.min(50, Math.max(1, parseInt(cols.value, 10) || 3));
          var html = "<table><tbody>";
          for (var i = 0; i < r; i++) {
            html += "<tr>";
            for (var j = 0; j < c; j++) {
              html +=
                i === 0 && header.checked ? "<th><br></th>" : "<td><br></td>";
            }
            html += "</tr>";
          }
          html += "</tbody></table><p><br></p>";
          close();
          self._exec("insertHTML", html);
        },
      });
    },

    _insertImageFile: function (file) {
      if (this.opts.uploadUrl) {
        var fd = new FormData();
        fd.append("file", file);
        return fetch(this.opts.uploadUrl, { method: "POST", body: fd })
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.text();
          })
          .then(function (txt) {
            var url = null;
            try {
              var j = JSON.parse(txt);
              url = j.url || j.src || j.file || (j.data && j.data.url);
            } catch (e) {
              url = txt.trim();
            }
            var safe = safeUrl(url, true);
            if (!safe) throw new Error("Invalid URL returned by server");
            return safe;
          });
      }
      // No backend configured: embed as a base64 data URL.
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var u = safeUrl(fr.result, true);
          if (u) resolve(u);
          else reject(new Error("Not an image"));
        };
        fr.onerror = function () {
          reject(fr.error || new Error("Read error"));
        };
        fr.readAsDataURL(file);
      });
    },

    // ----------------------------------------------------------------
    // HTML source mode
    // ----------------------------------------------------------------

    _toggleSource: function (force) {
      var next = typeof force === "boolean" ? force : !this._sourceMode;
      if (next === this._sourceMode) return;
      this._cancelColDrag();
      this._clearColHint();
      this._closeImageMenu();
      this._sourceMode = next;
      this.root.classList.toggle("se-source-mode", next);
      this.content.hidden = next;
      this.sourceWrap.hidden = !next;
      this._closePanel();
      if (next) {
        this.sourceArea.value = prettySerialize(this.getHTML());
        var ta = this.sourceArea;
        setTimeout(function () {
          ta.focus();
          // Start at the top: focus() alone leaves the caret at the end
          // of the text and scrolls the textarea down to it.
          ta.setSelectionRange(0, 0);
          ta.scrollTop = 0;
        }, 0);
      }
      this._updateToolbar();
    },

    _applySource: function () {
      if (!this._sourceMode) return;
      this.setHTML(this.sourceArea.value, { preserveUndo: true });
      this._toggleSource(false);
    },

    // ----------------------------------------------------------------
    // Change events
    // ----------------------------------------------------------------

    _emitChange: function () {
      if (this._destroyed) return;
      var self = this;
      if (this._changePending) return;
      this._changePending = true;
      var raf =
        window.requestAnimationFrame ||
        function (f) {
          setTimeout(f, 16);
        };
      raf(function () {
        self._changePending = false;
        if (self._destroyed) return;
        var html = self.getHTML();
        if (self._textarea) self._textarea.value = html;
        for (var i = 0; i < self._changeCbs.length; i++) {
          try {
            self._changeCbs[i](html, self);
          } catch (e) {}
        }
      });
    },

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------

    getHTML: function () {
      var clone = this.content.cloneNode(true);
      cleanTree(clone);
      return clone.innerHTML.trim();
    },

    setHTML: function (html, opts) {
      opts = opts || {};
      var clean = cleanHTMLString(String(html == null ? "" : html));

      if (opts.preserveUndo) {
        // Route through execCommand so the change lands on the native
        // undo stack (Ctrl+Z reverts it).
        this.content.focus();
        var sel = window.getSelection();
        try {
          sel.removeAllRanges();
          var r = document.createRange();
          r.selectNodeContents(this.content);
          sel.addRange(r);
          var ok = document.execCommand(
            "insertHTML",
            false,
            clean || "<p><br></p>",
          );
          if (!ok) throw new Error("insertHTML failed");
        } catch (e) {
          this.content.innerHTML = clean;
        }
      } else {
        this.content.innerHTML = clean;
      }

      this._savedRange = null;
      this._updatePlaceholder();
      this._updateToolbar();
      if (!opts.silent) this._emitChange();
    },

    onChange: function (cb) {
      if (typeof cb === "function") this._changeCbs.push(cb);
      return this;
    },

    focus: function () {
      if (this._sourceMode) this.sourceArea.focus();
      else this.content.focus();
    },

    _listen: function (target, type, fn) {
      target.addEventListener(type, fn);
      this._listeners.push({ target: target, type: type, fn: fn });
    },

    destroy: function () {
      if (this._destroyed) return;
      this._destroyed = true;
      this._closePanel();
      this._cancelColDrag();
      this._clearColHint();
      this._closeImageMenu();
      if (this._modal) this._modal.close();

      var html = this.getHTML();

      this._listeners.forEach(function (l) {
        l.target.removeEventListener(l.type, l.fn);
      });
      this._listeners = [];
      this._changeCbs = [];

      if (this._textarea) {
        this._textarea.classList.remove("se-hidden");
        this._textarea.value = html;
      } else if (this._origParent) {
        this._orig.innerHTML = html;
        this._origParent.insertBefore(this._orig, this.root);
      }
      if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    },
  };

  // ------------------------------------------------------------------
  // Static API
  // ------------------------------------------------------------------

  SimpleEditor.create = function (target, options) {
    return new SimpleEditor(target, options);
  };

  SimpleEditor.version = VERSION;
  SimpleEditor.sanitize = cleanHTMLString;
  SimpleEditor.strings = STRINGS;

  if (typeof module === "object" && module.exports) {
    module.exports = SimpleEditor;
  } else {
    global.SimpleEditor = SimpleEditor;
  }
})(window);
