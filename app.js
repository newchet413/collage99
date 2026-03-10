const templates = {
  custom: null,
  "ig-post": { ratio: 1, columns: 2, gap: 12, padding: 24, canvasWidth: 2000, canvasHeight: 2000 },
  "ig-story": { ratio: 0.5625, columns: 1, gap: 0, padding: 24, canvasWidth: 1080, canvasHeight: 1920 },
  "pinterest-pin": { ratio: 0.6667, columns: 2, gap: 16, padding: 24, canvasWidth: 1500, canvasHeight: 2250 },
  "facebook-cover": { ratio: 0.3125, columns: 1, gap: 0, padding: 20, canvasWidth: 1640, canvasHeight: 624 },
  "sbs-2": { ratio: 1, columns: 2, gap: 14, padding: 26, canvasWidth: 2000, canvasHeight: 1200 },
  "sbs-4": { ratio: 1, columns: 4, gap: 14, padding: 26, canvasWidth: 2600, canvasHeight: 1200 },
  "sbs-6": { ratio: 1, columns: 6, gap: 12, padding: 24, canvasWidth: 3200, canvasHeight: 1200 },
  "sbs-8": { ratio: 1, columns: 8, gap: 10, padding: 24, canvasWidth: 3800, canvasHeight: 1200 },
  "sbs-text-2": {
    ratio: 1,
    columns: 2,
    gap: 14,
    padding: 30,
    canvasWidth: 2000,
    canvasHeight: 1500,
    textZone: { enabled: true, position: "right", sizePercent: 32 },
  },
  "sbs-text-4": {
    ratio: 1,
    columns: 4,
    gap: 14,
    padding: 30,
    canvasWidth: 2600,
    canvasHeight: 1500,
    textZone: { enabled: true, position: "right", sizePercent: 32 },
  },
  "sbs-text-6": {
    ratio: 1,
    columns: 6,
    gap: 12,
    padding: 30,
    canvasWidth: 3200,
    canvasHeight: 1500,
    textZone: { enabled: true, position: "right", sizePercent: 30 },
  },
  "sbs-text-8": {
    ratio: 1,
    columns: 8,
    gap: 10,
    padding: 30,
    canvasWidth: 3800,
    canvasHeight: 1500,
    textZone: { enabled: true, position: "right", sizePercent: 28 },
  },
};

const HISTORY_LIMIT = 50;
const FILE_READ_BATCH = 12;

const state = {
  items: [],
  columns: 3,
  gap: 12,
  ratio: 1,
  background: "#ffffff",
  padding: 16,
  canvasPreset: "custom",
  canvasWidth: 2000,
  canvasHeight: 2000,
  previewZoom: 100,
  exportFormat: "png",
  exportQuality: 92,
  autoFillTemplate: false,
  snapToSlots: false,
  textZone: {
    enabled: false,
    position: "right",
    sizePercent: 30,
  },
  template: "custom",
  textOverlays: [],
  selectedTextId: null,
  textDraft: {
    content: "Your text",
    size: 56,
    color: "#111111",
    align: "left",
    shadow: true,
  },
};

const historyState = {
  past: [],
  future: [],
};

const imageCache = new Map();
let renderQueued = false;
let lastPreviewWidth = null;
let lastPreviewHeight = null;
let resizeFlashTimer = null;

const nodes = {
  input: document.getElementById("imagesInput"),
  projectInput: document.getElementById("projectInput"),
  template: document.getElementById("templateInput"),
  columns: document.getElementById("columnsInput"),
  gap: document.getElementById("gapInput"),
  ratio: document.getElementById("ratioInput"),
  background: document.getElementById("bgInput"),
  padding: document.getElementById("paddingInput"),
  canvasPreset: document.getElementById("canvasPresetInput"),
  canvasWidth: document.getElementById("canvasWidthInput"),
  canvasHeight: document.getElementById("canvasHeightInput"),
  previewZoom: document.getElementById("previewZoomInput"),
  exportFormat: document.getElementById("exportFormatInput"),
  exportQuality: document.getElementById("exportQualityInput"),
  autoFill: document.getElementById("autoFillInput"),
  snapSlots: document.getElementById("snapSlotsInput"),
  textInput: document.getElementById("textInput"),
  textSize: document.getElementById("textSizeInput"),
  textColor: document.getElementById("textColorInput"),
  textAlign: document.getElementById("textAlignInput"),
  textShadow: document.getElementById("textShadowInput"),
  textZoneEnabled: document.getElementById("textZoneEnabledInput"),
  textZonePosition: document.getElementById("textZonePositionInput"),
  textZoneSize: document.getElementById("textZoneSizeInput"),
  addText: document.getElementById("addTextBtn"),
  deleteText: document.getElementById("deleteTextBtn"),
  canvas: document.getElementById("collageCanvas"),
  canvasSizeReadout: document.getElementById("canvasSizeReadout"),
  status: document.getElementById("statusText"),
  saveProject: document.getElementById("saveProjectBtn"),
  undo: document.getElementById("undoBtn"),
  redo: document.getElementById("redoBtn"),
  shuffle: document.getElementById("shuffleBtn"),
  clear: document.getElementById("clearBtn"),
  export: document.getElementById("exportBtn"),
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function captureState() {
  return deepClone({
    items: state.items,
    columns: state.columns,
    gap: state.gap,
    ratio: state.ratio,
    background: state.background,
    padding: state.padding,
    canvasPreset: state.canvasPreset,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    previewZoom: state.previewZoom,
    exportFormat: state.exportFormat,
    exportQuality: state.exportQuality,
    autoFillTemplate: state.autoFillTemplate,
    snapToSlots: state.snapToSlots,
    textZone: state.textZone,
    template: state.template,
    textOverlays: state.textOverlays,
    textDraft: state.textDraft,
  });
}

function applyCapturedState(snapshot) {
  state.items = snapshot.items || [];
  state.columns = Number(snapshot.columns) || 3;
  state.gap = Number(snapshot.gap) || 12;
  state.ratio = Number(snapshot.ratio) || 1;
  state.background = snapshot.background || "#ffffff";
  state.padding = Number(snapshot.padding) || 16;
  state.canvasPreset = snapshot.canvasPreset || "custom";
  state.canvasWidth = clamp(Number(snapshot.canvasWidth) || 2000, 600, 8000);
  state.canvasHeight = clamp(Number(snapshot.canvasHeight) || 2000, 600, 8000);
  state.previewZoom = clamp(Number(snapshot.previewZoom) || 100, 50, 180);
  state.exportFormat = snapshot.exportFormat === "jpeg" ? "jpeg" : "png";
  state.exportQuality = clamp(Number(snapshot.exportQuality) || 92, 60, 100);
  state.autoFillTemplate = !!snapshot.autoFillTemplate;
  state.snapToSlots = !!snapshot.snapToSlots;
  state.textZone = {
    enabled: !!snapshot.textZone?.enabled,
    position: ["right", "left", "top", "bottom"].includes(snapshot.textZone?.position)
      ? snapshot.textZone.position
      : "right",
    sizePercent: clamp(Number(snapshot.textZone?.sizePercent) || 30, 15, 50),
  };
  state.template = snapshot.template || "custom";
  state.textOverlays = (snapshot.textOverlays || []).map((overlay) => ({
    id: overlay.id || uid(),
    content: String(overlay.content || "Your text"),
    x: Number(overlay.x) || 0,
    y: Number(overlay.y) || 0,
    size: Number(overlay.size) || 56,
    color: overlay.color || "#111111",
    align: overlay.align || "left",
    shadow: overlay.shadow !== false,
  }));
  state.selectedTextId = null;
  state.textDraft = {
    content: snapshot.textDraft?.content || "Your text",
    size: Number(snapshot.textDraft?.size) || 56,
    color: snapshot.textDraft?.color || "#111111",
    align: snapshot.textDraft?.align || "left",
    shadow: snapshot.textDraft?.shadow !== false,
  };
}

function announce(message) {
  if (nodes.status) {
    nodes.status.textContent = message;
  }
}

function updateHistoryButtons() {
  nodes.undo.disabled = historyState.past.length === 0;
  nodes.redo.disabled = historyState.future.length === 0;
}

function updateTextButtons() {
  nodes.deleteText.disabled = !state.selectedTextId;
}

function rememberForUndo() {
  historyState.past.push(captureState());
  if (historyState.past.length > HISTORY_LIMIT) {
    historyState.past.shift();
  }
  historyState.future = [];
  updateHistoryButtons();
}

function undo() {
  if (!historyState.past.length) {
    return;
  }
  historyState.future.push(captureState());
  const previous = historyState.past.pop();
  applyCapturedState(previous);
  syncControls();
  render();
  updateHistoryButtons();
  announce("Undid last change.");
}

function redo() {
  if (!historyState.future.length) {
    return;
  }
  historyState.past.push(captureState());
  const next = historyState.future.pop();
  applyCapturedState(next);
  syncControls();
  render();
  updateHistoryButtons();
  announce("Redid last change.");
}

function scheduleRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function getSelectedTextOverlay() {
  if (!state.selectedTextId) {
    return null;
  }
  return state.textOverlays.find((overlay) => overlay.id === state.selectedTextId) || null;
}

function syncControls() {
  nodes.template.value = state.template;
  nodes.columns.value = String(state.columns);
  nodes.gap.value = String(state.gap);
  nodes.ratio.value = String(state.ratio);
  nodes.background.value = state.background;
  nodes.padding.value = String(state.padding);
  nodes.canvasPreset.value = state.canvasPreset;
  nodes.canvasWidth.value = String(state.canvasWidth);
  nodes.canvasHeight.value = String(state.canvasHeight);
  nodes.previewZoom.value = String(state.previewZoom);
  nodes.exportFormat.value = state.exportFormat;
  nodes.exportQuality.value = String(state.exportQuality);
  nodes.autoFill.checked = state.autoFillTemplate;
  nodes.snapSlots.checked = state.snapToSlots;
  nodes.snapSlots.disabled = state.autoFillTemplate;
  nodes.textZoneEnabled.checked = state.textZone.enabled;
  nodes.textZonePosition.value = state.textZone.position;
  nodes.textZoneSize.value = String(state.textZone.sizePercent);

  const selected = getSelectedTextOverlay();
  const source = selected || state.textDraft;
  nodes.textInput.value = source.content;
  nodes.textSize.value = String(source.size);
  nodes.textColor.value = source.color;
  nodes.textAlign.value = source.align;
  nodes.textShadow.checked = source.shadow;
  updateTextButtons();
}

function markCustomTemplate() {
  state.template = "custom";
  nodes.template.value = "custom";
}

function reorderItems(from, to) {
  if (from === to || from < 0 || to < 0 || from >= state.items.length || to >= state.items.length) {
    return false;
  }
  const moved = state.items.splice(from, 1)[0];
  state.items.splice(to, 0, moved);
  return true;
}

function setTileImageStyles(img, item) {
  img.style.setProperty("--x", `${item.x}px`);
  img.style.setProperty("--y", `${item.y}px`);
  img.style.setProperty("--scale", `${item.scale}`);
}

function getEffectiveImageTransform(item) {
  if (state.autoFillTemplate) {
    return { x: 0, y: 0, scale: 1 };
  }
  return { x: item.x, y: item.y, scale: item.scale };
}

function snapValueToGrid(value, grid = 20) {
  return Math.round(value / grid) * grid;
}

function setOverlayStyles(element, overlay) {
  element.style.left = `${overlay.x}px`;
  element.style.top = `${overlay.y}px`;
  element.style.fontSize = `${overlay.size}px`;
  element.style.color = overlay.color;
  element.style.setProperty("--text-align", overlay.align);
  if (overlay.align === "center") {
    element.style.setProperty("--text-shift", "translateX(-50%)");
  } else if (overlay.align === "right") {
    element.style.setProperty("--text-shift", "translateX(-100%)");
  } else {
    element.style.setProperty("--text-shift", "none");
  }
  element.style.setProperty(
    "--text-shadow",
    overlay.shadow ? "0 1px 2px rgb(0 0 0 / 45%)" : "none",
  );
}

function getCanvasLayout(width, height, basePadding, zoneConfig) {
  let left = basePadding;
  let right = basePadding;
  let top = basePadding;
  let bottom = basePadding;
  let textZoneRect = null;

  const innerW = Math.max(0, width - left - right);
  const innerH = Math.max(0, height - top - bottom);
  if (zoneConfig.enabled) {
    if (zoneConfig.position === "left" || zoneConfig.position === "right") {
      const zoneW = Math.floor(innerW * (zoneConfig.sizePercent / 100));
      if (zoneConfig.position === "left") {
        textZoneRect = { x: left, y: top, w: zoneW, h: innerH };
        left += zoneW;
      } else {
        textZoneRect = { x: width - right - zoneW, y: top, w: zoneW, h: innerH };
        right += zoneW;
      }
    } else {
      const zoneH = Math.floor(innerH * (zoneConfig.sizePercent / 100));
      if (zoneConfig.position === "top") {
        textZoneRect = { x: left, y: top, w: innerW, h: zoneH };
        top += zoneH;
      } else {
        textZoneRect = { x: left, y: height - bottom - zoneH, w: innerW, h: zoneH };
        bottom += zoneH;
      }
    }
  }

  return {
    left,
    right,
    top,
    bottom,
    contentX: left,
    contentY: top,
    contentW: Math.max(0, width - left - right),
    contentH: Math.max(0, height - top - bottom),
    textZoneRect,
  };
}

function nudgeTile(index, dx, dy) {
  if (state.autoFillTemplate) {
    return;
  }
  const item = state.items[index];
  if (!item) {
    return;
  }
  item.x += dx;
  item.y += dy;
  if (state.snapToSlots) {
    item.x = snapValueToGrid(item.x);
    item.y = snapValueToGrid(item.y);
  }
  scheduleRender();
}

function nudgeText(overlay, dx, dy) {
  overlay.x += dx;
  overlay.y += dy;
  scheduleRender();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zoomTile(index, delta) {
  if (state.autoFillTemplate) {
    return;
  }
  const item = state.items[index];
  if (!item) {
    return;
  }
  item.scale = clamp(Number((item.scale + delta).toFixed(2)), 1, 2.4);
  scheduleRender();
}

function removeTile(index) {
  if (index < 0 || index >= state.items.length) {
    return;
  }
  rememberForUndo();
  state.items.splice(index, 1);
  render();
  announce("Removed photo.");
}

function selectTextOverlay(id) {
  state.selectedTextId = id;
  syncControls();
  scheduleRender();
}

function removeSelectedText() {
  if (!state.selectedTextId) {
    return;
  }
  const index = state.textOverlays.findIndex((overlay) => overlay.id === state.selectedTextId);
  if (index < 0) {
    return;
  }
  rememberForUndo();
  state.textOverlays.splice(index, 1);
  state.selectedTextId = null;
  syncControls();
  render();
  announce("Removed text layer.");
}

function addTextOverlay() {
  if (!state.items.length) {
    announce("Add at least one photo before adding text.");
    return;
  }

  const rect = nodes.canvas.getBoundingClientRect();
  const overlay = {
    id: uid(),
    content: state.textDraft.content,
    x: Math.max(8, rect.width / 2 - 120),
    y: Math.max(8, rect.height / 2 - 30),
    size: state.textDraft.size,
    color: state.textDraft.color,
    align: state.textDraft.align,
    shadow: state.textDraft.shadow,
  };

  rememberForUndo();
  state.textOverlays.push(overlay);
  state.selectedTextId = overlay.id;
  syncControls();
  render();
  announce("Added text layer.");
}

function makeTextDraggable(element, overlay) {
  let startX = 0;
  let startY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let wasDragging = false;

  const onMove = (ev) => {
    wasDragging = true;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    overlay.x = dragStartX + dx;
    overlay.y = dragStartY + dy;
    setOverlayStyles(element, overlay);
  };

  const onUp = () => {
    element.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (wasDragging) {
      announce("Moved text layer.");
    }
  };

  element.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    rememberForUndo();
    wasDragging = false;
    element.classList.add("dragging");
    if (element.setPointerCapture) {
      element.setPointerCapture(ev.pointerId);
    }
    selectTextOverlay(overlay.id);
    startX = ev.clientX;
    startY = ev.clientY;
    dragStartX = overlay.x;
    dragStartY = overlay.y;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function renderTextOverlays() {
  state.textOverlays.forEach((overlay) => {
    const textElement = document.createElement("div");
    textElement.className = "text-overlay";
    if (overlay.id === state.selectedTextId) {
      textElement.classList.add("selected");
    }
    textElement.tabIndex = 0;
    textElement.setAttribute("role", "button");
    textElement.setAttribute("aria-label", "Text layer");
    textElement.textContent = overlay.content;
    setOverlayStyles(textElement, overlay);

    textElement.addEventListener("click", () => {
      selectTextOverlay(overlay.id);
    });

    textElement.addEventListener("keydown", (ev) => {
      const step = ev.shiftKey ? 20 : 5;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        selectTextOverlay(overlay.id);
        removeSelectedText();
        return;
      }

      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        nudgeText(overlay, -step, 0);
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        nudgeText(overlay, step, 0);
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        nudgeText(overlay, 0, -step);
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        nudgeText(overlay, 0, step);
      }
    });

    makeTextDraggable(textElement, overlay);
    nodes.canvas.append(textElement);
  });
}

function render() {
  const hostWidth = Math.max(420, (nodes.canvas.parentElement?.clientWidth || 1100) - 24);
  const hostHeight = Math.max(360, Math.floor(window.innerHeight * 0.72));
  const fitScale = Math.min(hostWidth / state.canvasWidth, hostHeight / state.canvasHeight);
  const previewScale = clamp(fitScale * (state.previewZoom / 100), 0.18, 1.6);
  const previewWidth = Math.max(260, Math.floor(state.canvasWidth * previewScale));
  const previewHeight = Math.max(220, Math.floor(state.canvasHeight * previewScale));
  const previewPad = Math.max(4, Math.round(state.padding * previewScale));
  const previewLayout = getCanvasLayout(previewWidth, previewHeight, previewPad, state.textZone);

  nodes.canvas.style.width = `${previewWidth}px`;
  nodes.canvas.style.height = `${previewHeight}px`;
  nodes.canvas.style.minHeight = `${previewHeight}px`;
  nodes.canvas.style.gridTemplateColumns = `repeat(${state.columns}, 1fr)`;
  nodes.canvas.style.gap = `${state.gap}px`;
  nodes.canvas.style.background = state.background;
  nodes.canvas.style.paddingTop = `${previewLayout.top}px`;
  nodes.canvas.style.paddingRight = `${previewLayout.right}px`;
  nodes.canvas.style.paddingBottom = `${previewLayout.bottom}px`;
  nodes.canvas.style.paddingLeft = `${previewLayout.left}px`;
  nodes.canvas.style.aspectRatio = `${state.canvasWidth} / ${state.canvasHeight}`;
  nodes.canvasSizeReadout.textContent = `${state.canvasWidth} x ${state.canvasHeight}`;
  if (lastPreviewWidth !== previewWidth || lastPreviewHeight !== previewHeight) {
    nodes.canvas.classList.add("resized");
    window.clearTimeout(resizeFlashTimer);
    resizeFlashTimer = window.setTimeout(() => {
      nodes.canvas.classList.remove("resized");
    }, 220);
  }
  lastPreviewWidth = previewWidth;
  lastPreviewHeight = previewHeight;

  if (!state.items.length) {
    nodes.canvas.innerHTML = `<div class="empty-state">No photos yet. Click <b>Add Photos</b> to start.</div>`;
    return;
  }

  nodes.canvas.innerHTML = "";
  if (previewLayout.textZoneRect) {
    const textZone = document.createElement("div");
    textZone.className = "text-zone";
    textZone.style.left = `${previewLayout.textZoneRect.x}px`;
    textZone.style.top = `${previewLayout.textZoneRect.y}px`;
    textZone.style.width = `${previewLayout.textZoneRect.w}px`;
    textZone.style.height = `${previewLayout.textZoneRect.h}px`;
    nodes.canvas.append(textZone);
  }
  const fragment = document.createDocumentFragment();

  state.items.forEach((item, index) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.aspectRatio = String(state.ratio);
    tile.dataset.index = String(index);
    tile.tabIndex = 0;
    tile.setAttribute("role", "group");
    tile.setAttribute("aria-label", `Photo ${index + 1}`);

    tile.addEventListener("keydown", (ev) => {
      const step = ev.shiftKey ? 20 : 5;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        removeTile(index);
        return;
      }

      if ((ev.altKey || ev.metaKey) && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
        const targetIndex = ev.key === "ArrowLeft" ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < state.items.length) {
          ev.preventDefault();
          rememberForUndo();
          reorderItems(index, targetIndex);
          render();
          announce("Reordered photo.");
        }
        return;
      }

      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        nudgeTile(index, -step, 0);
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        nudgeTile(index, step, 0);
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        nudgeTile(index, 0, -step);
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        nudgeTile(index, 0, step);
      }
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        zoomTile(index, 0.05);
      }
      if (ev.key === "-") {
        ev.preventDefault();
        zoomTile(index, -0.05);
      }
    });

    tile.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      tile.classList.add("sorting");
    });

    tile.addEventListener("dragleave", () => {
      tile.classList.remove("sorting");
    });

    tile.addEventListener("drop", (ev) => {
      ev.preventDefault();
      tile.classList.remove("sorting");
      const from = Number(ev.dataTransfer.getData("text/plain"));
      const to = Number(tile.dataset.index);
      if (reorderItems(from, to)) {
        render();
        announce("Reordered photo.");
      }
    });

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = "Collage photo";
    img.draggable = false;
    img.loading = "lazy";
    img.decoding = "async";
    setTileImageStyles(img, getEffectiveImageTransform(item));
    makeDraggable(img, item);

    const handle = document.createElement("button");
    handle.className = "reorder-handle";
    handle.type = "button";
    handle.draggable = true;
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-label", `Reorder photo ${index + 1}`);
    handle.textContent = "≡";
    handle.addEventListener("dragstart", (ev) => {
      rememberForUndo();
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", String(index));
    });

    const zoom = document.createElement("input");
    zoom.className = "zoom";
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "2.4";
    zoom.step = "0.05";
    zoom.value = String(item.scale);
    zoom.disabled = state.autoFillTemplate;
    zoom.style.opacity = state.autoFillTemplate ? "0.35" : "1";
    zoom.setAttribute("aria-label", `Zoom photo ${index + 1}`);
    zoom.addEventListener(
      "pointerdown",
      () => {
        rememberForUndo();
      },
      { once: true },
    );
    zoom.addEventListener("input", () => {
      item.scale = Number(zoom.value);
      setTileImageStyles(img, item);
    });

    tile.append(img, handle, zoom);
    fragment.append(tile);
  });

  nodes.canvas.append(fragment);
  renderTextOverlays();
}

function makeDraggable(img, item) {
  let startX = 0;
  let startY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartScale = 1;
  let wasDragging = false;
  let dragMode = "move";
  let wheelUndoTimer = null;
  let wheelSessionActive = false;

  const onMove = (ev) => {
    wasDragging = true;
    if (state.autoFillTemplate) {
      return;
    }
    if (dragMode === "scale") {
      const delta = (startY - ev.clientY) * 0.005;
      item.scale = clamp(Number((dragStartScale + delta).toFixed(2)), 1, 2.4);
    } else {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      item.x = dragStartX + dx;
      item.y = dragStartY + dy;
    }
    setTileImageStyles(img, item);
  };

  const onUp = () => {
    img.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (wasDragging) {
      if (state.snapToSlots && dragMode === "move" && !state.autoFillTemplate) {
        item.x = snapValueToGrid(item.x);
        item.y = snapValueToGrid(item.y);
        setTileImageStyles(img, getEffectiveImageTransform(item));
      }
      if (dragMode === "scale") {
        announce("Resized photo.");
      } else {
        announce("Moved photo.");
      }
    }
  };

  img.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    if (state.autoFillTemplate) {
      return;
    }
    rememberForUndo();
    wasDragging = false;
    img.classList.add("dragging");
    startX = ev.clientX;
    startY = ev.clientY;
    dragStartX = item.x;
    dragStartY = item.y;
    dragStartScale = item.scale;
    dragMode = ev.shiftKey ? "scale" : "move";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  img.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      if (state.autoFillTemplate) {
        return;
      }
      if (!wheelSessionActive) {
        rememberForUndo();
        wheelSessionActive = true;
      }

      const delta = ev.deltaY < 0 ? 0.06 : -0.06;
      item.scale = clamp(Number((item.scale + delta).toFixed(2)), 1, 2.4);
      setTileImageStyles(img, item);
      announce("Resized photo.");

      window.clearTimeout(wheelUndoTimer);
      wheelUndoTimer = window.setTimeout(() => {
        wheelSessionActive = false;
      }, 250);
    },
    { passive: false },
  );
}

async function readFilesInBatches(files) {
  const createdItems = [];
  let skipped = 0;
  for (let i = 0; i < files.length; i += FILE_READ_BATCH) {
    const chunk = files.slice(i, i + FILE_READ_BATCH);
    const chunkItems = await Promise.all(
      chunk.map(
        (file) =>
          new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => {
              resolve({
                id: uid(),
                src: fr.result,
                x: 0,
                y: 0,
                scale: 1,
              });
            };
            fr.onerror = () => {
              skipped += 1;
              resolve(null);
            };
            fr.onabort = () => {
              skipped += 1;
              resolve(null);
            };
            fr.readAsDataURL(file);
          }),
      ),
    );
    const validItems = chunkItems.filter(Boolean);
    createdItems.push(...validItems);
    if (validItems.length) {
      state.items.push(...validItems);
      render();
    }
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
  return { createdItems, skipped };
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) {
    return;
  }
  rememberForUndo();
  const { createdItems, skipped } = await readFilesInBatches(files);
  if (!createdItems.length) {
    announce("No supported images were added.");
    return;
  }

  const addedMsg = `Added ${createdItems.length} photo${createdItems.length === 1 ? "" : "s"}.`;
  if (skipped > 0) {
    announce(`${addedMsg} Skipped ${skipped} unreadable file${skipped === 1 ? "" : "s"}.`);
  } else {
    announce(addedMsg);
  }
}

function shuffleItems() {
  if (state.items.length < 2) {
    return;
  }
  rememberForUndo();
  for (let i = state.items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.items[i], state.items[j]] = [state.items[j], state.items[i]];
  }
  render();
  announce("Shuffled photos.");
}

function clearAll() {
  if (!state.items.length && !state.textOverlays.length) {
    return;
  }
  rememberForUndo();
  state.items = [];
  state.textOverlays = [];
  state.selectedTextId = null;
  nodes.input.value = "";
  syncControls();
  render();
  announce("Cleared collage.");
}

function saveProject() {
  const payload = {
    version: 3,
    savedAt: new Date().toISOString(),
    state: captureState(),
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `collage99-project-${Date.now()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  announce("Saved project file.");
}

function isValidProject(data) {
  return data && typeof data === "object" && data.state && Array.isArray(data.state.items);
}

function loadProject(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const parsed = JSON.parse(fr.result);
      if (!isValidProject(parsed)) {
        throw new Error("Invalid project file.");
      }

      rememberForUndo();
      applyCapturedState(parsed.state);
      syncControls();
      render();
      announce("Loaded project file.");
    } catch {
      alert("Could not load project JSON.");
    }
  };
  fr.readAsText(file);
}

function applyTemplate(templateName) {
  if (state.template !== templateName) {
    rememberForUndo();
  }
  state.template = templateName;
  const template = templates[templateName];
  if (!template) {
    render();
    return;
  }

  state.columns = template.columns;
  state.gap = template.gap;
  state.ratio = template.ratio;
  state.padding = template.padding;
  state.canvasPreset = "custom";
  state.canvasWidth = template.canvasWidth || state.canvasWidth;
  state.canvasHeight = template.canvasHeight || state.canvasHeight;
  if (templateName.startsWith("sbs-")) {
    state.autoFillTemplate = true;
    state.snapToSlots = true;
  }
  state.textZone = template.textZone
    ? {
      enabled: !!template.textZone.enabled,
      position: template.textZone.position || "right",
      sizePercent: clamp(Number(template.textZone.sizePercent) || 30, 15, 50),
    }
    : { enabled: false, position: "right", sizePercent: 30 };
  syncControls();
  render();
  announce(`Applied ${nodes.template.selectedOptions[0].text} template.`);
}

function preloadImage(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

function drawTextOverlay(ctx, overlay, scaleX, scaleY) {
  const x = overlay.x * scaleX;
  const y = overlay.y * scaleY;
  const fontSize = Math.max(12, overlay.size * scaleY);
  const lineHeight = fontSize * 1.15;
  const lines = String(overlay.content).split("\n");

  ctx.save();
  ctx.fillStyle = overlay.color;
  ctx.font = `700 ${fontSize}px Trebuchet MS, Segoe UI, sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = overlay.align || "left";
  if (overlay.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + lineHeight * index);
  });
  ctx.restore();
}

async function exportImage() {
  if (!state.items.length && !state.textOverlays.length) {
    return;
  }

  const width = state.canvasWidth;
  const layout = getCanvasLayout(width, state.canvasHeight, state.padding, state.textZone);
  const contentWidth = layout.contentW;
  const cellW = Math.floor((contentWidth - state.gap * (state.columns - 1)) / state.columns);
  const cellH = Math.floor(cellW / state.ratio);
  const height = state.canvasHeight;

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, width, height);
  if (layout.textZoneRect) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(layout.textZoneRect.x, layout.textZoneRect.y, layout.textZoneRect.w, layout.textZoneRect.h);
  }

  if (state.items.length) {
    const imagePromises = state.items.map((item) => preloadImage(item.src));
    const loadedImages = await Promise.all(imagePromises);

    for (let i = 0; i < state.items.length; i += 1) {
      const item = state.items[i];
      const img = loadedImages[i];
      const transform = getEffectiveImageTransform(item);
      const row = Math.floor(i / state.columns);
      const col = i % state.columns;
      const x = layout.contentX + col * (cellW + state.gap);
      const y = layout.contentY + row * (cellH + state.gap);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();

      const previewRect = nodes.canvas.getBoundingClientRect();
      const offsetX = transform.x * (width / Math.max(previewRect.width, 1));
      const offsetY = transform.y * (height / Math.max(previewRect.height, 1));

      // Match preview behavior (`object-fit: cover`) so export keeps source aspect ratio.
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      const coverScale = Math.max(cellW / Math.max(imgW, 1), cellH / Math.max(imgH, 1));
      const drawW = imgW * coverScale * transform.scale;
      const drawH = imgH * coverScale * transform.scale;
      const drawX = x + (cellW - drawW) / 2 + offsetX;
      const drawY = y + (cellH - drawH) / 2 + offsetY;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
  }

  const previewRect = nodes.canvas.getBoundingClientRect();
  const scaleX = width / Math.max(1, previewRect.width);
  const scaleY = height / Math.max(1, previewRect.height);
  state.textOverlays.forEach((overlay) => {
    drawTextOverlay(ctx, overlay, scaleX, scaleY);
  });

  const isJpeg = state.exportFormat === "jpeg";
  const mimeType = isJpeg ? "image/jpeg" : "image/png";
  const extension = isJpeg ? "jpg" : "png";
  const link = document.createElement("a");
  link.download = `collage99-${Date.now()}.${extension}`;
  if (isJpeg) {
    link.href = out.toDataURL(mimeType, state.exportQuality / 100);
  } else {
    link.href = out.toDataURL(mimeType);
  }
  link.click();
  announce(`Exported ${state.exportFormat.toUpperCase()}.`);
}

function onConfigInput(mutator) {
  rememberForUndo();
  mutator();
  markCustomTemplate();
  scheduleRender();
}

function applyCanvasPreset(preset) {
  rememberForUndo();
  state.canvasPreset = preset;
  if (preset === "square") {
    state.canvasWidth = 2000;
    state.canvasHeight = 2000;
  } else if (preset === "story") {
    state.canvasWidth = 1080;
    state.canvasHeight = 1920;
  } else if (preset === "landscape") {
    state.canvasWidth = 1920;
    state.canvasHeight = 1080;
  } else if (preset === "portrait") {
    state.canvasWidth = 1080;
    state.canvasHeight = 1350;
  }
  markCustomTemplate();
  syncControls();
  render();
}

function onGlobalKeyDown(ev) {
  const key = ev.key.toLowerCase();
  if (!(ev.ctrlKey || ev.metaKey)) {
    return;
  }

  if (key === "z" && !ev.shiftKey) {
    ev.preventDefault();
    undo();
    return;
  }

  if (key === "y" || (key === "z" && ev.shiftKey)) {
    ev.preventDefault();
    redo();
    return;
  }

  if (key === "s") {
    ev.preventDefault();
    saveProject();
    return;
  }

  if (key === "e") {
    ev.preventDefault();
    exportImage();
    return;
  }

  if (key === "t" && ev.shiftKey) {
    ev.preventDefault();
    addTextOverlay();
  }
}

nodes.input.addEventListener("change", (ev) => {
  if (ev.target.files?.length) {
    addFiles(ev.target.files);
  }
});

nodes.projectInput.addEventListener("change", (ev) => {
  if (ev.target.files?.[0]) {
    loadProject(ev.target.files[0]);
  }
});

nodes.template.addEventListener("change", () => {
  applyTemplate(nodes.template.value);
});

nodes.columns.addEventListener("change", () => {
  onConfigInput(() => {
    state.columns = Number(nodes.columns.value);
  });
});

nodes.gap.addEventListener("change", () => {
  onConfigInput(() => {
    state.gap = Number(nodes.gap.value);
  });
});

nodes.ratio.addEventListener("change", () => {
  onConfigInput(() => {
    state.ratio = Number(nodes.ratio.value);
  });
});

nodes.background.addEventListener("change", () => {
  onConfigInput(() => {
    state.background = nodes.background.value;
  });
});

nodes.padding.addEventListener("change", () => {
  onConfigInput(() => {
    state.padding = Number(nodes.padding.value);
  });
});

nodes.canvasPreset.addEventListener("change", () => {
  if (nodes.canvasPreset.value === "custom") {
    state.canvasPreset = "custom";
    return;
  }
  applyCanvasPreset(nodes.canvasPreset.value);
});

function setCanvasDimension(axis, value, shouldRemember = false) {
  const clamped = clamp(Number(value) || 2000, 600, 8000);
  if (shouldRemember) {
    rememberForUndo();
  }
  state.canvasPreset = "custom";
  if (axis === "width") {
    state.canvasWidth = clamped;
  } else {
    state.canvasHeight = clamped;
  }
  markCustomTemplate();
  syncControls();
  render();
}

nodes.canvasWidth.addEventListener("input", () => {
  setCanvasDimension("width", nodes.canvasWidth.value);
});

nodes.canvasWidth.addEventListener("change", () => {
  setCanvasDimension("width", nodes.canvasWidth.value, true);
});

nodes.canvasHeight.addEventListener("input", () => {
  setCanvasDimension("height", nodes.canvasHeight.value);
});

nodes.canvasHeight.addEventListener("change", () => {
  setCanvasDimension("height", nodes.canvasHeight.value, true);
});

nodes.previewZoom.addEventListener("input", () => {
  state.previewZoom = clamp(Number(nodes.previewZoom.value), 50, 180);
  render();
});

nodes.previewZoom.addEventListener("change", () => {
  rememberForUndo();
  state.previewZoom = clamp(Number(nodes.previewZoom.value), 50, 180);
  render();
});

nodes.autoFill.addEventListener("change", () => {
  rememberForUndo();
  state.autoFillTemplate = nodes.autoFill.checked;
  if (state.autoFillTemplate) {
    state.snapToSlots = true;
  }
  markCustomTemplate();
  syncControls();
  render();
});

nodes.snapSlots.addEventListener("change", () => {
  rememberForUndo();
  state.snapToSlots = nodes.snapSlots.checked;
  markCustomTemplate();
  syncControls();
  render();
});

nodes.exportFormat.addEventListener("change", () => {
  rememberForUndo();
  state.exportFormat = nodes.exportFormat.value === "jpeg" ? "jpeg" : "png";
});

nodes.exportQuality.addEventListener("change", () => {
  rememberForUndo();
  state.exportQuality = clamp(Number(nodes.exportQuality.value), 60, 100);
});

nodes.textInput.addEventListener("input", () => {
  const value = nodes.textInput.value || "Your text";
  const selected = getSelectedTextOverlay();
  if (selected) {
    selected.content = value;
    scheduleRender();
  }
  state.textDraft.content = value;
});

nodes.textSize.addEventListener("input", () => {
  const size = Number(nodes.textSize.value);
  const selected = getSelectedTextOverlay();
  if (selected) {
    selected.size = size;
    scheduleRender();
  }
  state.textDraft.size = size;
});

nodes.textColor.addEventListener("input", () => {
  const selected = getSelectedTextOverlay();
  if (selected) {
    selected.color = nodes.textColor.value;
    scheduleRender();
  }
  state.textDraft.color = nodes.textColor.value;
});

nodes.textAlign.addEventListener("change", () => {
  rememberForUndo();
  const selected = getSelectedTextOverlay();
  if (selected) {
    selected.align = nodes.textAlign.value;
    scheduleRender();
  }
  state.textDraft.align = nodes.textAlign.value;
});

nodes.textShadow.addEventListener("change", () => {
  rememberForUndo();
  const selected = getSelectedTextOverlay();
  if (selected) {
    selected.shadow = nodes.textShadow.checked;
    scheduleRender();
  }
  state.textDraft.shadow = nodes.textShadow.checked;
});

nodes.textZoneEnabled.addEventListener("change", () => {
  rememberForUndo();
  state.textZone.enabled = nodes.textZoneEnabled.checked;
  markCustomTemplate();
  render();
});

nodes.textZonePosition.addEventListener("change", () => {
  rememberForUndo();
  state.textZone.position = nodes.textZonePosition.value;
  markCustomTemplate();
  render();
});

nodes.textZoneSize.addEventListener("input", () => {
  state.textZone.sizePercent = clamp(Number(nodes.textZoneSize.value), 15, 50);
  markCustomTemplate();
  render();
});

nodes.textZoneSize.addEventListener("change", () => {
  rememberForUndo();
  state.textZone.sizePercent = clamp(Number(nodes.textZoneSize.value), 15, 50);
  markCustomTemplate();
  render();
});

nodes.addText.addEventListener("click", addTextOverlay);
nodes.deleteText.addEventListener("click", removeSelectedText);
nodes.undo.addEventListener("click", undo);
nodes.redo.addEventListener("click", redo);
nodes.saveProject.addEventListener("click", saveProject);
nodes.shuffle.addEventListener("click", shuffleItems);
nodes.clear.addEventListener("click", clearAll);
nodes.export.addEventListener("click", exportImage);
window.addEventListener("keydown", onGlobalKeyDown);
window.addEventListener("resize", scheduleRender);

syncControls();
updateHistoryButtons();
render();
