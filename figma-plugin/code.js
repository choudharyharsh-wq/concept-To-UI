// Figma plugin sandbox — renders wireframe payload onto the canvas.
// Receives messages from ui.html via figma.ui.onmessage.

figma.showUI(__html__, { width: 300, height: 320 });

function send(type, text, level) {
  figma.ui.postMessage({ type, text, level });
}

// ── Type → Figma primitive mapping ───────────────────────────────────────────

const CONTAINER_TYPES = new Set([
  "FRAME", "NAV_BAR", "BOTTOM_TAB_BAR", "CARD",
  "MODAL_OVERLAY", "LIST_ITEM",
]);

const TEXT_TYPES = new Set([
  "TEXT_HEADING", "TEXT_BODY", "BADGE",
]);

// Elements that are rendered as a frame with a text child
const BUTTON_TYPES = new Set([
  "BUTTON", "FAB", "ICON_BUTTON",
]);

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

async function loadFont(weight) {
  const familyMap = {
    Regular:  { family: "Inter", style: "Regular" },
    Medium:   { family: "Inter", style: "Medium" },
    SemiBold: { family: "Inter", style: "Semi Bold" },
    Bold:     { family: "Inter", style: "Bold" },
  };
  const font = familyMap[weight] || familyMap["Regular"];
  await figma.loadFontAsync(font);
  return font;
}

// ── Render a single ElementSpec ───────────────────────────────────────────────

async function createElement(spec) {
  const fillRgb = hexToRgb(spec.fill_color || "#FFFFFF");
  const textRgb = hexToRgb(spec.text_color || "#000000");

  // ── Text-only elements ────────────────────────────────────────────────────
  if (TEXT_TYPES.has(spec.type)) {
    const font = await loadFont(spec.font_weight || "Regular");
    const node = figma.createText();
    node.name       = spec.label || spec.id;
    node.x          = spec.x;
    node.y          = spec.y;
    node.resize(spec.width, spec.height);
    await figma.loadFontAsync(font);
    node.fontName   = font;
    node.fontSize   = spec.font_size || (spec.type === "TEXT_HEADING" ? 20 : 14);
    node.characters = spec.label || "";
    node.fills      = [{ type: "SOLID", color: textRgb }];
    if (spec.type === "TEXT_HEADING") {
      node.textAlignHorizontal = "LEFT";
    }
    return node;
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  if (spec.type === "DIVIDER") {
    const node = figma.createLine();
    node.name = spec.id;
    node.x    = spec.x;
    node.y    = spec.y;
    node.resize(spec.width, 0);
    node.strokes = [{ type: "SOLID", color: fillRgb }];
    node.strokeWeight = 1;
    return node;
  }

  // ── Image placeholder ─────────────────────────────────────────────────────
  if (spec.type === "IMAGE_PLACEHOLDER") {
    const node  = figma.createFrame();
    node.name   = spec.label || spec.id;
    node.x      = spec.x;
    node.y      = spec.y;
    node.resize(spec.width, spec.height);
    node.cornerRadius   = spec.corner_radius || 8;
    node.fills = [{ type: "SOLID", color: hexToRgb("#D1D5DB") }];

    // Diagonal cross lines to signal "image area"
    const line1 = figma.createLine();
    line1.x = 0; line1.y = 0;
    line1.resize(spec.width, 0);
    line1.rotation = Math.atan2(spec.height, spec.width) * (180 / Math.PI);
    line1.strokes = [{ type: "SOLID", color: hexToRgb("#9CA3AF") }];
    line1.strokeWeight = 1;
    node.appendChild(line1);

    const font = await loadFont("Regular");
    const label = figma.createText();
    await figma.loadFontAsync(font);
    label.fontName   = font;
    label.fontSize   = 10;
    label.characters = spec.label || "Image";
    label.fills = [{ type: "SOLID", color: hexToRgb("#6B7280") }];
    label.x = 8; label.y = 8;
    node.appendChild(label);
    return node;
  }

  // ── Button / FAB / Icon Button ─────────────────────────────────────────────
  if (BUTTON_TYPES.has(spec.type)) {
    const node  = figma.createFrame();
    node.name   = spec.label || spec.id;
    node.x      = spec.x;
    node.y      = spec.y;
    node.resize(spec.width, spec.height);
    node.cornerRadius = (spec.corner_radius !== undefined && spec.corner_radius !== null) ? spec.corner_radius : (spec.type === "FAB" ? spec.height / 2 : 8);
    node.fills  = [{ type: "SOLID", color: fillRgb }];
    node.layoutMode = "HORIZONTAL";
    node.primaryAxisAlignItems   = "CENTER";
    node.counterAxisAlignItems   = "CENTER";
    node.paddingLeft = node.paddingRight = 16;

    const font = await loadFont(spec.font_weight || "SemiBold");
    const label = figma.createText();
    await figma.loadFontAsync(font);
    label.fontName   = font;
    label.fontSize   = spec.font_size || 14;
    label.characters = spec.label || "";
    label.fills = [{ type: "SOLID", color: textRgb }];
    node.appendChild(label);
    return node;
  }

  // ── Container types (FRAME, NAV_BAR, CARD, etc.) ─────────────────────────
  const node = figma.createFrame();
  node.name   = spec.label || spec.id;
  node.x      = spec.x;
  node.y      = spec.y;
  node.resize(spec.width, spec.height);
  node.cornerRadius = spec.corner_radius || 0;
  node.fills  = [{ type: "SOLID", color: fillRgb }];

  if (spec.type === "NAV_BAR") {
    node.layoutMode = "HORIZONTAL";
    node.primaryAxisAlignItems   = "SPACE_BETWEEN";
    node.counterAxisAlignItems   = "CENTER";
    node.paddingLeft = node.paddingRight = 16;
    node.paddingTop  = node.paddingBottom = 0;
  }

  if (spec.type === "BOTTOM_TAB_BAR") {
    node.layoutMode = "HORIZONTAL";
    node.primaryAxisAlignItems   = "SPACE_BETWEEN";
    node.counterAxisAlignItems   = "CENTER";
    node.paddingLeft = node.paddingRight = 24;
  }

  if (spec.type === "CARD") {
    node.cornerRadius = spec.corner_radius || 12;
    node.effects = [{
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.08 },
      offset: { x: 0, y: 2 },
      radius: 8,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    }];
  }

  // Add a label inside for non-trivial containers so layout is visible
  if (spec.label && spec.type !== "FRAME") {
    const font = await loadFont("Medium");
    const label = figma.createText();
    await figma.loadFontAsync(font);
    label.fontName   = font;
    label.fontSize   = spec.font_size || 13;
    label.characters = spec.label;
    label.fills = [{ type: "SOLID", color: textRgb }];
    label.x = 12;
    label.y = Math.max(0, (spec.height - (spec.font_size || 13)) / 2);
    node.appendChild(label);
  }

  return node;
}

// ── Render a full screen ──────────────────────────────────────────────────────

async function renderScreen(screenSpec, offsetX) {
  // Top-level screen frame
  const screenFrame = figma.createFrame();
  screenFrame.name    = screenSpec.screen_name || screenSpec.screen_id;
  screenFrame.x       = offsetX;
  screenFrame.y       = 100;
  screenFrame.resize(screenSpec.width || 390, screenSpec.height || 844);
  screenFrame.fills   = [{ type: "SOLID", color: hexToRgb(screenSpec.background_color || "#FFFFFF") }];
  screenFrame.clipsContent = true;

  // Build id→node map for child wiring
  const nodeMap = {};

  // First pass: create all elements
  const elements = screenSpec.elements || [];
  for (const spec of elements) {
    try {
      const node = await createElement(spec);
      nodeMap[spec.id] = node;
    } catch (err) {
      send("LOG", `  [SKIP] ${spec.id}: ${err.message}`, "");
    }
  }

  // Second pass: append children to parents, orphans go to screen frame
  const childIds = new Set(elements.flatMap(e => e.children || []));

  for (const spec of elements) {
    const node = nodeMap[spec.id];
    if (!node) continue;

    if (childIds.has(spec.id)) continue; // will be appended by parent

    // Check if this element is a child of another
    const parent = elements.find(e => (e.children || []).includes(spec.id));
    if (parent && nodeMap[parent.id]) {
      nodeMap[parent.id].appendChild(node);
    } else {
      screenFrame.appendChild(node);
    }
  }

  // Append nested children
  for (const spec of elements) {
    const parentNode = nodeMap[spec.id];
    if (!parentNode || !(spec.children || []).length) continue;
    for (const childId of spec.children) {
      const childNode = nodeMap[childId];
      if (childNode && childNode.parent === null) {
        // Not yet parented — shouldn't happen after second pass but safety net
        parentNode.appendChild(childNode);
      }
    }
  }

  figma.currentPage.appendChild(screenFrame);
  return screenFrame;
}

// ── Main message handler ──────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  if (msg.type === "CLEAR") {
    figma.currentPage.selection.forEach(n => n.remove());
    send("LOG", "[SYS] Selection cleared.");
    return;
  }

  if (msg.type === "RENDER") {
    const screens = (msg.payload && msg.payload.screens) ? msg.payload.screens : [];
    if (screens.length === 0) {
      send("ERROR", "Payload has no screens.");
      return;
    }

    send("LOG", `[SYS] Rendering ${screens.length} screen(s)…`, "info");

    const GAP     = 60;
    let   offsetX = 100;

    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      send("LOG", `[${i + 1}/${screens.length}] Drawing "${screen.screen_name}"…`);
      try {
        const frame = await renderScreen(screen, offsetX);
        offsetX += (screen.width || 390) + GAP;

        // Scroll viewport to the first rendered screen
        if (i === 0) {
          figma.viewport.scrollAndZoomIntoView([frame]);
        }
      } catch (err) {
        send("LOG", `  [ERR] ${screen.screen_name}: ${err.message}`, "error");
      }
    }

    // Select all rendered frames so the user can see them
    const rendered = figma.currentPage.children.slice(-screens.length);
    figma.currentPage.selection = rendered.filter(n => n.type === "FRAME");

    send("DONE", `${screens.length} screen(s) rendered on canvas.`);
  }
};
