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

function isInputType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "INPUT_FIELD" || t === "INPUT" || t === "TEXT_FIELD"
    || t === "TEXTFIELD" || t === "FIELD" || t === "SEARCH" || t === "SEARCH_BAR"
    || t.indexOf("INPUT") !== -1 || t.indexOf("TEXTFIELD") !== -1;
}

function isListItemType(type) {
  if (!type) return false;
  var t = type.toUpperCase();
  return t === "LIST_ITEM" || t === "LISTITEM" || t === "ROW" || t === "LIST_ROW"
    || t === "CELL" || t === "MENU_ITEM" || t === "SECTION_ROW"
    || t.indexOf("LIST_ITEM") !== -1 || t.indexOf("LIST_ROW") !== -1;
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
    // Push real content INTO the instance — text properties, variants, booleans —
    // so the rendered component shows the screen's actual text, not its defaults.
    await applyInstanceContent(instance, spec);
    return instance;
  } catch (err) {
    send("LOG", "  [FALLBACK] importComponentByKeyAsync failed for " + spec.type + ": " + err.message);
    return createElement(spec);
  }
}

// Collect every font used by the instance's text layers and load them. Editing a
// TEXT component property (or a text node's characters) FAILS unless its font is
// loaded first — the POP DS uses custom fonts (Figtree, Awesome Serif), so this
// is essential, not optional.
async function loadInstanceFonts(instance) {
  var texts = [];
  try { texts = instance.findAll(function(n){ return n.type === "TEXT"; }); } catch(e) {}
  var fonts = {};
  for (var i = 0; i < texts.length; i++) {
    var t = texts[i];
    try {
      if (t.fontName && t.fontName !== figma.mixed) {
        fonts[t.fontName.family + "||" + t.fontName.style] = t.fontName;
      } else if (typeof t.characters === "string" && t.characters.length > 0) {
        var segs = t.getRangeAllFontNames(0, t.characters.length);
        for (var s = 0; s < segs.length; s++) {
          fonts[segs[s].family + "||" + segs[s].style] = segs[s];
        }
      }
    } catch(e) {}
  }
  for (var k in fonts) {
    try { await figma.loadFontAsync(fonts[k]); } catch(e) {}
  }
  return texts;
}

// Match a human property name (e.g. "Title text") to the instance's real property
// key (e.g. "Title text#123:0"), apply props by type, and fall back to writing the
// label into the primary text slot when the model gave no props.
async function applyInstanceContent(instance, spec) {
  var props = spec.props || {};
  var hasProps = false;
  for (var _ in props) { hasProps = true; break; }

  var texts = await loadInstanceFonts(instance);

  var defs = {};
  try { defs = instance.componentProperties || {}; } catch(e) { defs = {}; }

  function bareName(key) {
    var i = key.indexOf("#");
    return (i !== -1 ? key.slice(0, i) : key);
  }
  function findKey(name) {
    var target = String(name).toLowerCase();
    for (var key in defs) {
      if (bareName(key).toLowerCase() === target) return key;
    }
    return null;
  }
  function asBool(v) {
    return v === true || /^(true|yes|on|1)$/i.test(String(v));
  }

  // Find a TEXT-type component property whose name looks like the element's main
  // visible label (e.g. "Title text", "L - Label", "Label text"). This is the slot
  // a DS component shows by default — the model often fills the wrong one (e.g.
  // "Placeholder text" on POP's Input field, which isn't shown in the empty state).
  function findLabelKey() {
    for (var key in defs) {
      if (defs[key] && defs[key].type === "TEXT" && /title|label/i.test(bareName(key))) return key;
    }
    return null;
  }
  function setOne(key, value) {
    var p = {}; p[key] = value;
    try { instance.setProperties(p); return true; }
    catch (e) { send("LOG", "  [WARN] prop '" + bareName(key) + "' rejected on " + spec.type + ": " + e.message); return false; }
  }

  // 1) Apply explicit props from the model.
  var payload = {};
  var titleishApplied = false;
  for (var name in props) {
    var key = findKey(name);
    if (!key) continue;
    var ptype = defs[key] && defs[key].type;
    payload[key] = (ptype === "BOOLEAN") ? asBool(props[name]) : String(props[name]); // TEXT/VARIANT/INSTANCE_SWAP → string
    if (ptype === "TEXT" && /title|label/i.test(bareName(key))) titleishApplied = true;
  }
  var appliedAny = false;
  for (var _2 in payload) { appliedAny = true; break; }
  if (appliedAny) {
    try {
      instance.setProperties(payload);
    } catch (e) {
      // One invalid value rejects the whole payload — retry each key alone so a bad
      // variant choice never blocks the text from being applied.
      for (var pk in payload) setOne(pk, payload[pk]);
    }
  }

  // 2) Safety net: guarantee the element's main visible label is never left at the
  //    component default (e.g. "Title"). If the model didn't target a title/label
  //    text slot, fill it from `label` ourselves.
  if (spec.label && !titleishApplied) {
    var labelKey = findLabelKey();
    if (labelKey && !(labelKey in payload)) {
      setOne(labelKey, String(spec.label));
    } else if (!appliedAny && !labelKey) {
      // No props matched AND no dedicated label slot — last resort: first TEXT prop,
      // else the first text layer not bound to a property.
      var firstText = null;
      for (var k2 in defs) { if (defs[k2] && defs[k2].type === "TEXT") { firstText = k2; break; } }
      if (firstText) {
        setOne(firstText, String(spec.label));
      } else {
        for (var j = 0; j < texts.length; j++) {
          var tn = texts[j];
          if (tn.componentPropertyReferences && tn.componentPropertyReferences.characters) continue;
          try { tn.characters = String(spec.label); break; } catch(e) {}
        }
      }
    }
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

  // ── Input field (bordered box with a visible placeholder/label) ──────────
  if (isInputType(spec.type)) {
    var inpNode          = figma.createFrame();
    inpNode.name         = spec.label || spec.id;
    inpNode.x            = spec.x;
    inpNode.y            = spec.y;
    inpNode.resize(spec.width, spec.height);
    inpNode.cornerRadius = (spec.corner_radius !== undefined && spec.corner_radius !== null) ? spec.corner_radius : 8;
    inpNode.fills        = [{ type: "SOLID", color: fillRgb }];
    inpNode.strokes      = [{ type: "SOLID", color: hexToRgb("#D1D5DB", { r: 0.82, g: 0.84, b: 0.86 }) }];
    inpNode.strokeWeight = 1;
    inpNode.layoutMode              = "HORIZONTAL";
    inpNode.primaryAxisAlignItems   = "MIN";
    inpNode.counterAxisAlignItems   = "CENTER";
    inpNode.paddingLeft = inpNode.paddingRight = 12;
    var inpFont          = await loadFont(spec.font_weight || "Regular");
    var inpLbl           = figma.createText();
    await figma.loadFontAsync(inpFont);
    inpLbl.fontName      = inpFont;
    inpLbl.fontSize      = spec.font_size || 14;
    inpLbl.characters    = spec.label || "";
    // Placeholder-style muted text so it reads as a field value, not a heading.
    inpLbl.fills         = [{ type: "SOLID", color: hexToRgb("#9CA3AF", { r: 0.61, g: 0.64, b: 0.69 }) }];
    inpNode.appendChild(inpLbl);
    return inpNode;
  }

  // ── List item / row (label rendered as visible left-aligned text) ────────
  if (isListItemType(spec.type)) {
    var rowNode          = figma.createFrame();
    rowNode.name         = spec.label || spec.id;
    rowNode.x            = spec.x;
    rowNode.y            = spec.y;
    rowNode.resize(spec.width, spec.height);
    rowNode.cornerRadius = spec.corner_radius || 0;
    rowNode.fills        = [{ type: "SOLID", color: fillRgb }];
    rowNode.layoutMode              = "HORIZONTAL";
    rowNode.primaryAxisAlignItems   = "MIN";
    rowNode.counterAxisAlignItems   = "CENTER";
    rowNode.paddingLeft = rowNode.paddingRight = 16;
    var rowFont          = await loadFont(spec.font_weight || "Regular");
    var rowLbl           = figma.createText();
    await figma.loadFontAsync(rowFont);
    rowLbl.fontName      = rowFont;
    rowLbl.fontSize      = spec.font_size || 14;
    rowLbl.characters    = spec.label || "";
    rowLbl.fills         = [{ type: "SOLID", color: textRgb }];
    rowLbl.layoutGrow    = 1;
    rowNode.appendChild(rowLbl);
    return rowNode;
  }

  // ── Container (FRAME, NAV_BAR, CARD, MODAL, etc.) ─────────────────────────
  var ctnNode          = figma.createFrame();
  ctnNode.name         = spec.label || spec.id;
  ctnNode.x            = spec.x;
  ctnNode.y            = spec.y;
  ctnNode.resize(spec.width, spec.height);
  ctnNode.cornerRadius = spec.corner_radius || 0;
  ctnNode.fills        = [{ type: "SOLID", color: fillRgb }];

  var isTopBar = (specType.indexOf("NAV") !== -1 || specType === "HEADER"
    || specType.indexOf("APP_BAR") !== -1 || specType.indexOf("TOP") !== -1)
    && specType.indexOf("TAB") === -1 && specType.indexOf("BOTTOM") === -1;

  if (isTopBar) {
    ctnNode.layoutMode              = "HORIZONTAL";
    ctnNode.primaryAxisAlignItems   = "SPACE_BETWEEN";
    ctnNode.counterAxisAlignItems   = "CENTER";
    ctnNode.paddingLeft = ctnNode.paddingRight = 16;
    ctnNode.paddingTop  = ctnNode.paddingBottom = 0;
    // Render the bar's title as visible text (not just a layer name).
    if (spec.label) {
      var navFont       = await loadFont(spec.font_weight || "SemiBold");
      var navLbl        = figma.createText();
      await figma.loadFontAsync(navFont);
      navLbl.fontName   = navFont;
      navLbl.fontSize   = spec.font_size || 17;
      navLbl.characters = spec.label;
      navLbl.fills      = [{ type: "SOLID", color: textRgb }];
      ctnNode.appendChild(navLbl);
    }
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
