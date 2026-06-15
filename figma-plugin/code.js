// Figma plugin sandbox — renders wireframe payload onto the canvas.
// Receives messages from ui.html via figma.ui.onmessage.

figma.showUI(__html__, { width: 300, height: 320 });

function send(type, text, level) {
  figma.ui.postMessage({ type, text, level });
}

// ── Type detection helpers ────────────────────────────────────────────────────
// Use keyword matching so LLM variants like "Label", "Heading", "Body", "Text"
// all route to the right Figma primitive regardless of exact casing.

function isTextType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "TEXT_HEADING" || t === "TEXT_BODY" || t === "BADGE"
    || t === "TEXT" || t === "LABEL" || t === "HEADING" || t === "BODY"
    || t === "CAPTION" || t === "SUBHEADING" || t === "LINK"
    || t.indexOf("TEXT") !== -1 || t.indexOf("HEADING") !== -1
    || t.indexOf("LABEL") !== -1 || t.indexOf("BODY") !== -1;
}

function isButtonType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "BUTTON" || t === "FAB" || t === "ICON_BUTTON"
    || t === "CTA" || t === "CHIP"
    || (t.indexOf("BUTTON") !== -1 && t.indexOf("TAB") === -1 && t.indexOf("RADIO") === -1);
}

function isDividerType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "DIVIDER" || t === "SEPARATOR" || t === "RULE";
}

function isImageType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "IMAGE_PLACEHOLDER" || t === "IMAGE" || t === "AVATAR"
    || t === "THUMBNAIL" || t.indexOf("IMAGE") !== -1 || t.indexOf("PHOTO") !== -1;
}

// ── DS mode: instantiate a real component by its Figma key ───────────────────

async function createDSInstance(spec) {
  if (!spec.ds_key) {
    // No key — fall back to generic render for this element
    send("LOG", "  [FALLBACK] No ds_key for " + spec.type + " — rendering as primitive.");
    return createElement(spec);
  }
  try {
    var component = await figma.importComponentByKeyAsync(spec.ds_key);
    var instance  = component.createInstance();
    instance.name = spec.label || spec.type;
    instance.x    = spec.x;
    instance.y    = spec.y;
    // Resize only if the instance allows it (some components are fixed-size)
    try { instance.resize(spec.width, spec.height); } catch(e) {}
    return instance;
  } catch (err) {
    send("LOG", "  [FALLBACK] importComponentByKeyAsync failed for " + spec.type + ": " + err.message);
    return createElement(spec);
  }
}

function hexToRgb(hex, fallback) {
  fallback = fallback || { r: 0, g: 0, b: 0 };
  if (!hex || typeof hex !== "string") return fallback;
  var clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map(function(c) { return c + c; }).join("");
  }
  if (clean.length !== 6) return fallback;
  var r = parseInt(clean.slice(0, 2), 16);
  var g = parseInt(clean.slice(2, 4), 16);
  var b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;
  return { r: r / 255, g: g / 255, b: b / 255 };
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
  // Safe colour parsing — never produces NaN
  var fillRgb  = hexToRgb(spec.fill_color, { r: 1,   g: 1,   b: 1   });
  var textRgb  = hexToRgb(spec.text_color, { r: 0.1, g: 0.1, b: 0.1 });
  var specType = (spec.type || "").toUpperCase();

  // ── Text / Label / Heading / Body ────────────────────────────────────────
  if (isTextType(spec.type)) {
    var isHeading = specType.indexOf("HEADING") !== -1 || specType.indexOf("HEADER") !== -1;
    var txtFont   = await loadFont(spec.font_weight || (isHeading ? "SemiBold" : "Regular"));
    var txtNode   = figma.createText();
    txtNode.name  = spec.label || spec.id;
    txtNode.x     = spec.x;
    txtNode.y     = spec.y;
    await figma.loadFontAsync(txtFont);
    txtNode.fontName        = txtFont;
    txtNode.fontSize        = spec.font_size || (isHeading ? 20 : 14);
    txtNode.characters      = spec.label || "";
    txtNode.fills           = [{ type: "SOLID", color: textRgb }];
    txtNode.textAutoResize  = "HEIGHT";
    try { txtNode.resize(spec.width, spec.height); } catch(e) {}
    return txtNode;
  }

  // ── Divider / Separator ───────────────────────────────────────────────────
  if (isDividerType(spec.type)) {
    var divNode       = figma.createLine();
    divNode.name      = spec.id;
    divNode.x         = spec.x;
    divNode.y         = spec.y;
    divNode.resize(spec.width, 0);
    divNode.strokes   = [{ type: "SOLID", color: hexToRgb("#E5E7EB", { r: 0.9, g: 0.9, b: 0.9 }) }];
    divNode.strokeWeight = 1;
    return divNode;
  }

  // ── Image / Avatar / Thumbnail placeholder ────────────────────────────────
  if (isImageType(spec.type)) {
    var imgNode          = figma.createFrame();
    imgNode.name         = spec.label || spec.id;
    imgNode.x            = spec.x;
    imgNode.y            = spec.y;
    imgNode.resize(spec.width, spec.height);
    imgNode.cornerRadius = spec.corner_radius || 8;
    imgNode.fills        = [{ type: "SOLID", color: hexToRgb("#D1D5DB", { r: 0.82, g: 0.84, b: 0.86 }) }];
    var imgFont          = await loadFont("Regular");
    var imgLbl           = figma.createText();
    await figma.loadFontAsync(imgFont);
    imgLbl.fontName      = imgFont;
    imgLbl.fontSize      = 10;
    imgLbl.characters    = spec.label || "Image";
    imgLbl.fills         = [{ type: "SOLID", color: hexToRgb("#6B7280", { r: 0.42, g: 0.45, b: 0.5 }) }];
    imgLbl.x = 8;
    imgLbl.y = 8;
    imgNode.appendChild(imgLbl);
    return imgNode;
  }

  // ── Button / FAB / CTA ────────────────────────────────────────────────────
  if (isButtonType(spec.type)) {
    var btnNode          = figma.createFrame();
    btnNode.name         = spec.label || spec.id;
    btnNode.x            = spec.x;
    btnNode.y            = spec.y;
    btnNode.resize(spec.width, spec.height);
    var isFab            = specType === "FAB";
    btnNode.cornerRadius = (spec.corner_radius !== undefined && spec.corner_radius !== null)
      ? spec.corner_radius : (isFab ? spec.height / 2 : 8);
    btnNode.fills        = [{ type: "SOLID", color: fillRgb }];
    btnNode.layoutMode   = "HORIZONTAL";
    btnNode.primaryAxisAlignItems = "CENTER";
    btnNode.counterAxisAlignItems = "CENTER";
    btnNode.paddingLeft  = btnNode.paddingRight = 16;
    var btnFont          = await loadFont(spec.font_weight || "SemiBold");
    var btnLbl           = figma.createText();
    await figma.loadFontAsync(btnFont);
    btnLbl.fontName      = btnFont;
    btnLbl.fontSize      = spec.font_size || 14;
    btnLbl.characters    = spec.label || "";
    btnLbl.fills         = [{ type: "SOLID", color: textRgb }];
    btnNode.appendChild(btnLbl);
    return btnNode;
  }

  // ── Container (FRAME, NAV_BAR, CARD, MODAL, etc.) ─────────────────────────
  var ctnNode          = figma.createFrame();
  ctnNode.name         = spec.label || spec.id;
  ctnNode.x            = spec.x;
  ctnNode.y            = spec.y;
  ctnNode.resize(spec.width, spec.height);
  ctnNode.cornerRadius = spec.corner_radius || 0;
  ctnNode.fills        = [{ type: "SOLID", color: fillRgb }];

  if (specType.indexOf("NAV") !== -1 || specType === "HEADER") {
    ctnNode.layoutMode              = "HORIZONTAL";
    ctnNode.primaryAxisAlignItems   = "SPACE_BETWEEN";
    ctnNode.counterAxisAlignItems   = "CENTER";
    ctnNode.paddingLeft = ctnNode.paddingRight = 16;
    ctnNode.paddingTop  = ctnNode.paddingBottom = 0;
  }

  if (specType.indexOf("TAB_BAR") !== -1 || specType.indexOf("BOTTOM_TAB") !== -1 || specType.indexOf("NAVIGATION") !== -1) {
    ctnNode.layoutMode              = "HORIZONTAL";
    ctnNode.primaryAxisAlignItems   = "SPACE_BETWEEN";
    ctnNode.counterAxisAlignItems   = "CENTER";
    ctnNode.paddingLeft = ctnNode.paddingRight = 24;
  }

  if (specType.indexOf("CARD") !== -1) {
    ctnNode.cornerRadius = spec.corner_radius || 12;
    ctnNode.effects      = [{
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.08 },
      offset: { x: 0, y: 2 },
      radius: 8, spread: 0,
      visible: true, blendMode: "NORMAL",
    }];
  }

  // Container labels are layer names only — no visible text rendered inside.
  return ctnNode;
}

// ── Render a full screen ──────────────────────────────────────────────────────

async function renderScreen(screenSpec, offsetX, dsMode) {
  // Create the top-level screen frame first and add it to the page.
  // All child elements must be appended INTO this frame immediately after
  // creation — if we call figma.create*() without immediately reparenting,
  // Figma auto-appends the node to figma.currentPage at its raw coordinates,
  // which causes all elements to pile up on the page canvas instead of
  // sitting inside their screen frame.
  const screenFrame = figma.createFrame();
  screenFrame.name         = screenSpec.screen_name || screenSpec.screen_id;
  screenFrame.x            = offsetX;
  screenFrame.y            = 100;
  screenFrame.resize(screenSpec.width || 390, screenSpec.height || 844);
  screenFrame.fills        = [{ type: "SOLID", color: hexToRgb(screenSpec.background_color, { r: 1, g: 1, b: 1 }) }];
  screenFrame.clipsContent = true;
  figma.currentPage.appendChild(screenFrame);

  const elements = screenSpec.elements || [];

  // Single pass: create each element and append it to screenFrame immediately.
  // dsMode = true  → use importComponentByKeyAsync (real DS instances)
  // dsMode = false → use createElement (generic Figma primitives)
  for (var i = 0; i < elements.length; i++) {
    var spec = elements[i];
    try {
      var node = dsMode ? await createDSInstance(spec) : await createElement(spec);
      screenFrame.appendChild(node);
    } catch (err) {
      send("LOG", "  [SKIP] " + spec.id + ": " + err.message);
    }
  }

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
    var screens = (msg.payload && msg.payload.screens) ? msg.payload.screens : [];
    var dsMode  = (msg.payload && msg.payload.ds_mode) ? true : false;

    if (screens.length === 0) {
      send("ERROR", "Payload has no screens.");
      return;
    }

    send("LOG", "[SYS] Mode: " + (dsMode ? "DS components (real instances)" : "fallback primitives"));
    send("LOG", "[SYS] Rendering " + screens.length + " screen(s)…", "info");

    const GAP     = 60;
    let   offsetX = 100;

    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      send("LOG", `[${i + 1}/${screens.length}] Drawing "${screen.screen_name}"…`);
      try {
        const frame = await renderScreen(screen, offsetX, dsMode);
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
