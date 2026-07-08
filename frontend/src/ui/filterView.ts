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
} from "../state/filterState";
import { escapeHtml, MODE_LABELS } from "./html";
import type { PanelView } from "./panel";

const expandedModes = new Set<Mode>();

function renderGroup(mode: Mode): string {
  const lines = getSeenLines(mode);
  const expanded = expandedModes.has(mode);
  const checked = isModeEnabled(mode) ? "checked" : "";
  const chips = lines
    .map((seen) => {
      const enabled = isLineEnabled(seen.mode, seen.line);
      const bg = seen.bg_color ?? "#4a90d9";
      const fg = seen.fg_color ?? "#ffffff";
      return `<button class="line-chip vehicle-line-badge ${enabled ? "" : "line-chip-disabled"}"
        data-mode="${mode}" data-line="${escapeHtml(seen.line)}"
        style="background:${bg};color:${fg}">${escapeHtml(seen.line)}</button>`;
    })
    .join("");
  return `
    <div class="filter-group" data-mode="${mode}">
      <div class="filter-group-header">
        <label class="filter-mode-label">
          <input type="checkbox" class="filter-mode-toggle" data-mode="${mode}" ${checked}>
          <span>${MODE_LABELS[mode]}</span>
        </label>
        <button class="filter-expand" data-mode="${mode}" aria-label="Visa linjer">
          ${expanded ? "▾" : "▸"}<span class="filter-line-count">${lines.length || ""}</span>
        </button>
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
                    <div class="filter-chips">${chips}</div>`
                  : `<div class="filter-empty">Inga linjer sedda ännu — panorera kartan</div>`
              }
            </div>`
          : ""
      }
    </div>`;
}

export function createFilterView(): PanelView {
  const el = document.createElement("div");
  el.className = "filter-view";

  function render(): void {
    el.innerHTML =
      ALL_MODES.map(renderGroup).join("") +
      `<div class="filter-settings">
        <label class="filter-mode-label">
          <input type="checkbox" class="filter-zoom-toggle"
            ${isHideBusesOnZoomOut() ? "checked" : ""}>
          <span>Dölj bussar vid utzoomning</span>
        </label>
      </div>`;
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
    const target = (e.target as HTMLElement).closest("button");
    if (!target) return;
    const mode = target.dataset.mode as Mode;
    if (target.matches(".filter-expand")) {
      if (expandedModes.has(mode)) {
        expandedModes.delete(mode);
      } else {
        expandedModes.add(mode);
      }
      render();
    } else if (target.matches(".line-chip")) {
      const line = target.dataset.line!;
      setLineEnabled(mode, line, !isLineEnabled(mode, line));
    } else if (target.matches(".filter-all")) {
      setAllLinesEnabled(mode, true);
    } else if (target.matches(".filter-none")) {
      setAllLinesEnabled(mode, false);
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
