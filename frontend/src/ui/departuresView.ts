import { fetchDepartures } from "../api/stops";
import { DEPARTURES_REFRESH_MS } from "../config";
import { isFavorite, toggleFavorite } from "../state/favoritesState";
import type { Departure } from "../types/stop";
import { escapeHtml } from "./html";
import type { PanelView } from "./panel";

const COUNTDOWN_RERENDER_MS = 10_000;
// Show a countdown under this horizon, otherwise a clock time
const COUNTDOWN_HORIZON_MS = 20 * 60_000;
// Delays under a minute aren't worth highlighting
const DELAY_THRESHOLD_MS = 60_000;

function formatTimeCell(dep: Departure): string {
  if (dep.is_cancelled) {
    return `<span class="dep-cancelled">Inställd</span>`;
  }
  const planned = Date.parse(dep.planned_time);
  const estimated = dep.estimated_time ? Date.parse(dep.estimated_time) : null;
  const effective = estimated ?? planned;
  const now = Date.now();
  const untilMs = effective - now;
  const minutes = Math.max(0, Math.round(untilMs / 60_000));
  const clock = new Date(effective).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const main = untilMs < COUNTDOWN_HORIZON_MS
    ? minutes === 0
      ? "Nu"
      : `${minutes} min`
    : clock;
  const delayed = estimated !== null && estimated - planned >= DELAY_THRESHOLD_MS;
  if (delayed) {
    const plannedClock = new Date(planned).toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `<span class="dep-time dep-delayed">${main}</span>
      <span class="dep-planned-struck">${plannedClock}</span>`;
  }
  return `<span class="dep-time">${main}</span>`;
}

function renderRows(departures: Departure[]): string {
  if (!departures.length) {
    return `<div class="dep-empty">Inga avgångar den närmaste timmen</div>`;
  }
  const sorted = [...departures].sort(
    (a, b) =>
      Date.parse(a.estimated_time ?? a.planned_time) -
      Date.parse(b.estimated_time ?? b.planned_time),
  );
  return sorted
    .map((dep) => {
      const bg = dep.bg_color ?? "#4a90d9";
      const fg = dep.fg_color ?? "#ffffff";
      return `<div class="dep-row ${dep.is_cancelled ? "dep-row-cancelled" : ""}">
        <span class="vehicle-line-badge" style="background:${bg};color:${fg}">${escapeHtml(dep.line)}</span>
        <span class="dep-destination">
          ${dep.destination ? escapeHtml(dep.destination) : "–"}
          ${dep.is_part_cancelled && !dep.is_cancelled ? `<span class="dep-warn" title="Delvis inställd">⚠</span>` : ""}
          ${dep.platform ? `<span class="dep-platform">Läge ${escapeHtml(dep.platform)}</span>` : ""}
        </span>
        <span class="dep-time-cell">${formatTimeCell(dep)}</span>
      </div>`;
    })
    .join("");
}

export function createDeparturesView(stop: {
  gid: string;
  name: string;
}): PanelView {
  const el = document.createElement("div");
  el.className = "departures-view";
  el.innerHTML = `<div class="dep-loading">Hämtar avgångar…</div>`;

  let departures: Departure[] = [];
  let fetchInterval: number | null = null;
  let renderInterval: number | null = null;
  let inFlight: AbortController | null = null;
  let hasData = false;
  // Platforms (lägen) selected in the pill filter; null = show all
  let selectedPlatforms: Set<string> | null = null;

  function platformsPresent(): string[] {
    const platforms = new Set<string>();
    for (const dep of departures) {
      if (dep.platform) platforms.add(dep.platform);
    }
    return [...platforms].sort((a, b) =>
      a.localeCompare(b, "sv", { numeric: true }),
    );
  }

  function renderPlatformPills(): string {
    const platforms = platformsPresent();
    if (platforms.length < 2) return "";
    const pills = platforms
      .map(
        (p) => `<button class="dep-pill ${
          selectedPlatforms === null || selectedPlatforms.has(p) ? "dep-pill-active" : ""
        }" data-platform="${escapeHtml(p)}">${escapeHtml(p)}</button>`,
      )
      .join("");
    return `<div class="dep-platform-pills">
      <button class="dep-pill dep-pill-all ${selectedPlatforms === null ? "dep-pill-active" : ""}"
        data-platform="__all__">Alla lägen</button>${pills}</div>`;
  }

  function visibleDepartures(): Departure[] {
    if (selectedPlatforms === null) return departures;
    return departures.filter(
      (dep) => dep.platform !== null && selectedPlatforms!.has(dep.platform),
    );
  }

  function renderFavoriteRow(): string {
    const starred = isFavorite(stop.gid);
    return `<button class="dep-favorite ${starred ? "dep-favorite-active" : ""}">
      ${starred ? "★ Sparad hållplats" : "☆ Spara hållplats"}</button>`;
  }

  function render(stale = false): void {
    el.innerHTML = `
      ${stale ? `<div class="dep-stale">Kunde inte uppdatera — visar senast kända</div>` : ""}
      ${renderFavoriteRow()}
      ${renderPlatformPills()}
      ${renderRows(visibleDepartures())}
      <div class="dep-caveat">Uppdateras var 30:e sekund</div>`;
  }

  el.addEventListener("click", (e) => {
    const favorite = (e.target as HTMLElement).closest(".dep-favorite");
    if (favorite) {
      toggleFavorite({ gid: stop.gid, name: stop.name });
      render();
      return;
    }
    const pill = (e.target as HTMLElement).closest<HTMLElement>(".dep-pill");
    if (!pill) return;
    const platform = pill.dataset.platform!;
    const all = platformsPresent();
    if (platform === "__all__") {
      selectedPlatforms = null;
    } else if (selectedPlatforms === null) {
      // From "all shown", narrowing to just the tapped läge feels natural
      selectedPlatforms = new Set([platform]);
    } else {
      if (selectedPlatforms.has(platform)) {
        selectedPlatforms.delete(platform);
      } else {
        selectedPlatforms.add(platform);
      }
      // Everything (or nothing) selected is the same as no filter
      if (selectedPlatforms.size === 0 || selectedPlatforms.size === all.length) {
        selectedPlatforms = null;
      }
    }
    render();
  });

  async function refresh(): Promise<void> {
    if (document.hidden) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    try {
      const response = await fetchDepartures(stop.gid, controller.signal);
      departures = response.departures;
      hasData = true;
      render();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn("departures fetch failed:", err);
      if (hasData) {
        render(true);
      } else {
        el.innerHTML = `<div class="dep-error">Kunde inte hämta avgångar</div>`;
      }
    }
  }

  const onVisibility = () => {
    if (!document.hidden) void refresh();
  };

  return {
    el,
    title: stop.name,
    onMount() {
      void refresh();
      fetchInterval = window.setInterval(() => void refresh(), DEPARTURES_REFRESH_MS);
      renderInterval = window.setInterval(() => {
        if (hasData && !document.hidden) render();
      }, COUNTDOWN_RERENDER_MS);
      document.addEventListener("visibilitychange", onVisibility);
    },
    onUnmount() {
      if (fetchInterval !== null) clearInterval(fetchInterval);
      if (renderInterval !== null) clearInterval(renderInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      inFlight?.abort();
    },
  };
}
