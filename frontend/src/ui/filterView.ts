import {
  ALL_MODES,
  getSeenLines,
  isHideBusesOnZoomOut,
  isLineEnabled,
  isModeEnabled,
  setAllLinesEnabled,
  setHideBusesOnZoomOut,
  setLineEnabled,
  setModeEnabled,
  subscribe,
  type Mode,
  type SeenLine,
} from "../state/filterState";
import { escapeHtml, MODE_ICONS, MODE_LABELS } from "./html";
import type { PanelView } from "./panel";

const expandedModes = new Set<Mode>();

// Lines that are plain numbers are "regular"; X-lines, FLYG etc. are express/special
const REGULAR_LINE = /^\d+$/;

function renderChip(seen: SeenLine): string {
  const enabled = isLineEnabled(seen.mode, seen.line);
  const bg = seen.bg_color ?? "#4a90d9";
  const fg = seen.fg_color ?? "#ffffff";
  return `<button class="line-chip vehicle-line-badge ${enabled ? "" : "line-chip-disabled"}"
    data-mode="${seen.mode}" data-line="${escapeHtml(seen.line)}"
    style="background:${bg};color:${fg}">${escapeHtml(seen.line)}</button>`;
}

function renderGroup(mode: Mode): string {
  const lines = getSeenLines(mode);
  const expanded = expandedModes.has(mode);
  const checked = isModeEnabled(mode) ? "checked" : "";
  const regular = lines.filter((l) => REGULAR_LINE.test(l.line));
  const special = lines.filter((l) => !REGULAR_LINE.test(l.line));
  const showSublabels = regular.length > 0 && special.length > 0;
  return `
    <div class="filter-group" data-mode="${mode}">
      <div class="filter-group-header" data-mode="${mode}" role="button">
        <input type="checkbox" class="filter-mode-toggle" data-mode="${mode}" ${checked}
          aria-label="Visa ${MODE_LABELS[mode]}">
        <span class="filter-mode-icon">${MODE_ICONS[mode]}</span>
        <span class="filter-mode-name">${MODE_LABELS[mode]}</span>
        <span class="filter-count">${lines.length ? `${lines.length} linjer` : ""}</span>
        <span class="filter-chevron">${expanded ? "▾" : "▸"}</span>
      </div>
      ${
        expanded
          ? `<div class="filter-lines">
              ${
                lines.length
                  ? `<div class="filter-line-actions">
                      <button class="filter-all" data-mode="${mode}">Alla</button>
                      <button class="filter-none" data-mode="${mode}">Inga</button>
                    </div>
                    ${showSublabels ? `<div class="filter-chip-sublabel">Linjer</div>` : ""}
                    ${regular.length ? `<div class="filter-chips">${regular.map(renderChip).join("")}</div>` : ""}
                    ${showSublabels ? `<div class="filter-chip-sublabel">Express &amp; övriga</div>` : ""}
                    ${special.length ? `<div class="filter-chips">${special.map(renderChip).join("")}</div>` : ""}`
                  : `<div class="filter-empty">Inga linjer sedda ännu — panorera kartan</div>`
              }
            </div>`
          : ""
      }
    </div>`;
}

function renderSettings(): string {
  return `
    <div class="filter-section-title">Inställningar</div>
    <label class="filter-setting-row">
      <span>Dölj bussar vid utzoomning</span>
      <input type="checkbox" class="filter-zoom-toggle switch"
        ${isHideBusesOnZoomOut() ? "checked" : ""}>
    </label>`;
}

export function createFilterView(): PanelView {
  const el = document.createElement("div");
  el.className = "filter-view";

  function render(): void {
    el.innerHTML = ALL_MODES.map(renderGroup).join("") + renderSettings();
  }

  el.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.matches(".filter-mode-toggle")) {
      setModeEnabled(target.dataset.mode as Mode, target.checked);
    } else if (target.matches(".filter-zoom-toggle")) {
      setHideBusesOnZoomOut(target.checked);
    }
  });
  el.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // The checkbox handles itself; don't let its clicks toggle expansion
    if (target instanceof HTMLInputElement) return;

    const button = target.closest("button");
    if (button) {
      const mode = button.dataset.mode as Mode;
      if (button.matches(".line-chip")) {
        const line = button.dataset.line!;
        setLineEnabled(mode, line, !isLineEnabled(mode, line));
      } else if (button.matches(".filter-all")) {
        setAllLinesEnabled(mode, true);
      } else if (button.matches(".filter-none")) {
        setAllLinesEnabled(mode, false);
      }
      return;
    }

    // Tapping anywhere else on the header row toggles expansion
    const header = target.closest<HTMLElement>(".filter-group-header");
    if (header) {
      const mode = header.dataset.mode as Mode;
      if (expandedModes.has(mode)) {
        expandedModes.delete(mode);
      } else {
        expandedModes.add(mode);
      }
      render();
    }
  });

  let unsubscribe: (() => void) | null = null;
  return {
    el,
    title: "Filter",
    onMount() {
      render();
      unsubscribe = subscribe(render);
    },
    onUnmount() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

/** Compact mode toggles for the bottom sheet's collapsed (peek) state */
export function createPeekModeBar(): HTMLElement {
  const el = document.createElement("div");
  el.className = "panel-peek-modes";

  function render(): void {
    el.innerHTML = ALL_MODES.map(
      (mode) => `<button class="peek-mode-btn ${isModeEnabled(mode) ? "" : "peek-mode-off"}"
        data-mode="${mode}" aria-label="${MODE_LABELS[mode]}"
        aria-pressed="${isModeEnabled(mode)}">${MODE_ICONS[mode]}</button>`,
    ).join("");
  }

  el.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest("button");
    if (!button) return;
    const mode = button.dataset.mode as Mode;
    setModeEnabled(mode, !isModeEnabled(mode));
  });

  render();
  subscribe(render);
  return el;
}
