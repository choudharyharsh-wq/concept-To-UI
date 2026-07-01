// to-design.ts — turn generated HTML screens into Figma-pasteable clipboard data
// via code.to.design "clipboard mode".
//
// Why the offscreen render: our screens are styled by the Tailwind CDN, which
// only generates real CSS when it RUNS in a browser. The to.design API parses
// static <style> CSS — it won't execute our CDN script. So we render each screen
// in a hidden iframe, let Tailwind inject its <style>, then serialize the live
// DOM (now containing real CSS) and send THAT.

import type { HtmlScreen } from "@/hooks/use-generation-stream";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Combined-doc layout
const SCREEN_GAP = 64;   // px between screen frames in the exported row
const PAGE_PAD = 64;     // px padding around the row

/**
 * Merge all screens into ONE document laid out in a horizontal row, so a single
 * paste yields every frame. All screens in a run share one theme/<head>, so we
 * take the first screen's head and wrap each screen's body in a fixed 390×844
 * box. fixed/sticky elements are re-anchored to their own box (absolute) so
 * bottom-navs/headers don't collapse onto the shared viewport.
 */
function buildCombinedDoc(screens: HtmlScreen[]): string {
  const parser = new DOMParser();
  const first = parser.parseFromString(screens[0].html, "text/html");
  const headHtml = first.head.innerHTML;

  const wraps = screens
    .map((s) => {
      const doc = parser.parseFromString(s.html, "text/html");
      const bodyClass = doc.body.getAttribute("class") || "";
      const w = s.viewport_width || 390;
      const h = s.viewport_height || 844;
      return (
        `<div class="c2d-screen ${bodyClass}" ` +
        `style="width:${w}px;height:${h}px" data-screen="${s.screen_id}">` +
        `${doc.body.innerHTML}</div>`
      );
    })
    .join("");

  // Scoped overrides: pin each screen to its own box and re-anchor fixed/sticky.
  const overrideCss = `
    /* Kill the page body background so it doesn't become one giant rectangle
       behind every screen — each wrapper paints its own bg via the body class. */
    html, body { background: transparent !important; background-color: transparent !important; margin: 0 !important; }
    .c2d-row { display:flex; gap:${SCREEN_GAP}px; align-items:flex-start; padding:${PAGE_PAD}px; }
    /* Each screen is pinned to its own fixed box; min-h-screen must not expand it. */
    .c2d-screen { position:relative; flex:none; overflow:hidden; min-height:0 !important; }
    /* Only re-anchor FIXED (which escapes to the viewport). Leave STICKY alone —
       in a non-scrolling fixed-height box it stays in flow at the top, exactly as
       intended. Converting sticky→absolute pulls it out of flow and shifts the
       whole screen's content up underneath the header. */
    .c2d-screen .fixed { position:absolute !important; }
  `;

  return (
    "<!DOCTYPE html><html><head>" +
    headHtml +
    `<style id="c2d-override">${overrideCss}</style>` +
    `</head><body style="margin:0"><div class="c2d-row">${wraps}</div></body></html>`
  );
}

/** Wait until the Tailwind CDN has injected its generated <style> (or timeout). */
async function waitForStyles(doc: Document, timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  let last = -1;
  let stable = 0;
  return new Promise((resolve) => {
    const tick = () => {
      const len = Array.from(doc.querySelectorAll("style")).reduce(
        (n, s) => n + (s.textContent?.length || 0),
        0
      );
      // Resolve once the total <style> volume has stopped growing (CDN done)…
      if (len > 0 && len === last) {
        stable += 1;
        if (stable >= 2) return resolve();
      } else {
        stable = 0;
      }
      last = len;
      if (Date.now() - start > timeoutMs) return resolve(); // …or give up.
      setTimeout(tick, 150);
    };
    tick();
  });
}

/**
 * Render `html` in a hidden iframe so the Tailwind CDN materializes real CSS,
 * then return the serialized document with scripts stripped (static CSS baked in).
 */
async function renderToStaticHtml(html: string): Promise<string> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    "position:fixed;left:-99999px;top:0;width:2000px;height:1400px;visibility:hidden;border:0"
  );
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      iframe.addEventListener("load", () => resolve(), { once: true });
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("offscreen iframe document unavailable");
    await waitForStyles(doc);

    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script").forEach((s) => s.remove()); // drop CDN/config scripts
    return "<!DOCTYPE html>" + clone.outerHTML;
  } finally {
    iframe.remove();
  }
}

/**
 * Build the Figma clipboard blob (text/html) for ALL screens in one document.
 * Returns the string to place on the clipboard. Throws on failure.
 */
export async function prepareFigmaClipboard(screens: HtmlScreen[]): Promise<string> {
  if (!screens.length) throw new Error("no screens to export");

  const combined = buildCombinedDoc(screens);
  const staticHtml = await renderToStaticHtml(combined);

  const res = await fetch(`${BACKEND_URL}/api/to-design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: staticHtml, clip: true }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`to.design proxy failed (HTTP ${res.status}): ${msg.slice(0, 200)}`);
  }
  return res.text();
}

/**
 * Write the prepared clipboard blob to the system clipboard as text/html.
 * MUST be called inside a user-gesture handler. Prefers the async Clipboard API;
 * falls back to the execCommand copy-event trick.
 */
export async function writeToClipboard(blob: string): Promise<void> {
  // Preferred: async Clipboard API with a text/html ClipboardItem.
  if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([blob], { type: "text/html" }) }),
      ]);
      return;
    } catch {
      // fall through to legacy path
    }
  }
  // Fallback: intercept a synthetic copy event and inject text/html.
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/html", blob);
    e.preventDefault();
  };
  document.addEventListener("copy", onCopy, { once: true });
  const ok = document.execCommand("copy");
  document.removeEventListener("copy", onCopy);
  if (!ok) throw new Error("clipboard write was blocked by the browser");
}
