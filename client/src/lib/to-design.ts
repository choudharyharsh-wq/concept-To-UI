// to-design.ts — turn generated HTML screens into Figma-pasteable clipboard data
// via code.to.design "clipboard mode", using the /html-multi endpoint.
//
// Why /html-multi: it accepts an array of screens and lays them out side-by-side
// itself, so we DON'T merge everything into one <body> (which produced a stray
// background-box layer and forced fixed/sticky hacks). Each screen is rendered
// individually at its own viewport → correct headers/navs, no wrapper artifact.
//
// Why the offscreen render: our screens are styled by the Tailwind CDN, which
// only generates real CSS when it RUNS in a browser. The to.design API parses
// static <style> CSS — it won't execute our CDN script. So we render each screen
// in a hidden iframe (sized to its viewport), let Tailwind inject its <style>,
// then serialize the live DOM (now containing real CSS) and send THAT.

import type { HtmlScreen } from "@/hooks/use-generation-stream";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

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
      if (len > 0 && len === last) {
        stable += 1;
        if (stable >= 2) return resolve();
      } else {
        stable = 0;
      }
      last = len;
      if (Date.now() - start > timeoutMs) return resolve();
      setTimeout(tick, 150);
    };
    tick();
  });
}

/**
 * Render one screen's HTML in a hidden iframe sized to its viewport (width fixed
 * at the mobile width, height = the base viewport) so the Tailwind CDN
 * materializes real CSS and viewport units resolve. Returns the serialized
 * static HTML AND the screen's NATURAL content height — tall screens keep their
 * full length instead of being clamped to 844.
 */
async function renderScreen(
  html: string,
  w: number,
  h: number
): Promise<{ html: string; height: number }> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(
    "style",
    `position:fixed;left:-99999px;top:0;width:${w}px;height:${h}px;visibility:hidden;border:0`
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

    // Natural height = tallest of the base viewport and the actual scroll height,
    // so long screens are exported/rendered at full length (not cropped to 844).
    const scroll = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0
    );
    const height = Math.max(h, Math.round(scroll));

    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script").forEach((s) => s.remove()); // drop CDN/config scripts
    return { html: "<!DOCTYPE html>" + clone.outerHTML, height };
  } finally {
    iframe.remove();
  }
}

/** Measure a screen's natural rendered height (used by the canvas). */
export async function measureScreenHeight(html: string, w = 390, baseH = 844): Promise<number> {
  try {
    const { height } = await renderScreen(html, w, baseH);
    return height;
  } catch {
    return baseH;
  }
}

/**
 * Build the Figma clipboard blob for ALL screens via /html-multi.
 * Renders each screen to static HTML, sends them as a `screens` array, and
 * returns the clipboard text to place on the system clipboard. Throws on failure.
 *
 * Cost: to.design bills /html-multi at 1 credit per 4 screens.
 */
export async function prepareFigmaClipboard(screens: HtmlScreen[]): Promise<string> {
  if (!screens.length) throw new Error("no screens to export");

  const entries: { html: string; width: number; height: number; name: string }[] = [];
  for (const s of screens) {
    const w = s.viewport_width || 390;
    const baseH = s.viewport_height || 844;
    const { html: staticHtml, height } = await renderScreen(s.html, w, baseH);
    // height = natural content height → long screens stay full length.
    entries.push({ html: staticHtml, width: w, height, name: s.screen_name });
  }

  const res = await fetch(`${BACKEND_URL}/api/to-design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "html-multi", clip: true, screens: entries }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`to.design failed (HTTP ${res.status}): ${msg.slice(0, 200)}`);
  }
  return res.text();
}

/** Fetch remaining to.design credit balance (best-effort; null if unavailable). */
export async function fetchBalance(): Promise<number | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/to-design/balance`);
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data === "number") return data;
    const v = data?.balance ?? data?.credits ?? data?.available ?? data?.remaining;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Write the prepared clipboard blob to the system clipboard as text/html.
 * MUST be called inside a user-gesture handler. Prefers the async Clipboard API;
 * falls back to the execCommand copy-event trick.
 */
export async function writeToClipboard(blob: string): Promise<void> {
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
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/html", blob);
    e.preventDefault();
  };
  document.addEventListener("copy", onCopy, { once: true });
  const ok = document.execCommand("copy");
  document.removeEventListener("copy", onCopy);
  if (!ok) throw new Error("clipboard write was blocked by the browser");
}
