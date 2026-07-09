import type maplibregl from "maplibre-gl";
import { fetchRoute, searchJourneys, searchLocations } from "../api/journeys";
import { clearRoute, drawRoute } from "../map/routeLayer";
import {
  consumePicks,
  setActiveLines,
  subscribePicks,
} from "../state/routeState";
import type { Journey, LocationHit } from "../types/journey";
import { escapeHtml, MODE_ICONS } from "./html";
import type { PanelView } from "./panel";

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

interface Endpoint {
  input: HTMLInputElement;
  dropdown: HTMLElement;
  selected: LocationHit | null;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMinutes(journey: Journey): number {
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  const start = Date.parse(first.origin.estimated_time ?? first.origin.planned_time);
  const end = Date.parse(
    last.destination.estimated_time ?? last.destination.planned_time,
  );
  return Math.round((end - start) / 60_000);
}

function renderJourney(journey: Journey, index: number, selected: boolean): string {
  const first = journey.legs[0];
  const last = journey.legs[journey.legs.length - 1];
  const depPlanned = first.origin.planned_time;
  const depEstimated = first.origin.estimated_time;
  const delayed =
    depEstimated !== null &&
    Date.parse(depEstimated) - Date.parse(depPlanned) >= 60_000;
  const cancelled = journey.legs.some((l) => l.is_cancelled);
  const badges = journey.legs
    .map(
      (leg) => `<span class="vehicle-line-badge journey-leg-badge"
        style="background:${leg.bg_color ?? "#4a90d9"};color:${leg.fg_color ?? "#ffffff"}"
        >${MODE_ICONS[leg.mode] ?? ""} ${escapeHtml(leg.line)}</span>`,
    )
    .join(`<span class="journey-leg-arrow">›</span>`);
  const changes = journey.legs.length - 1;
  return `
    <button class="journey-card ${selected ? "journey-card-selected" : ""} ${cancelled ? "journey-card-cancelled" : ""}"
      data-index="${index}">
      <div class="journey-times">
        <span class="journey-dep ${delayed ? "dep-delayed" : ""}">${formatClock(depEstimated ?? depPlanned)}</span>
        ${delayed ? `<span class="dep-planned-struck">${formatClock(depPlanned)}</span>` : ""}
        <span class="journey-arrow">→</span>
        <span>${formatClock(last.destination.estimated_time ?? last.destination.planned_time)}</span>
        <span class="journey-duration">${durationMinutes(journey)} min</span>
      </div>
      <div class="journey-legs">${badges}</div>
      <div class="journey-meta">
        ${cancelled ? `<span class="dep-cancelled">Inställd</span>` : ""}
        ${changes > 0 ? `${changes} byte${changes > 1 ? "n" : ""}` : "Direkt"}
        · från läge ${escapeHtml(first.origin.platform ?? "?")}
      </div>
    </button>`;
}

export function createPlannerView(map: maplibregl.Map): PanelView {
  const el = document.createElement("div");
  el.className = "planner-view";
  el.innerHTML = `
    <div class="planner-form">
      <div class="planner-field">
        <input type="text" class="planner-input" data-endpoint="origin"
          placeholder="Från (hållplats)" autocomplete="off">
        <div class="planner-dropdown" data-endpoint="origin" hidden></div>
      </div>
      <button class="planner-swap" aria-label="Byt riktning">⇅</button>
      <div class="planner-field">
        <input type="text" class="planner-input" data-endpoint="dest"
          placeholder="Till (hållplats)" autocomplete="off">
        <div class="planner-dropdown" data-endpoint="dest" hidden></div>
      </div>
    </div>
    <div class="planner-hint">Tips: håll fingret på kartan för att välja härifrån/hit</div>
    <div class="planner-results"></div>`;

  const results = el.querySelector<HTMLElement>(".planner-results")!;
  const endpoints: Record<"origin" | "dest", Endpoint> = {
    origin: {
      input: el.querySelector('.planner-input[data-endpoint="origin"]')!,
      dropdown: el.querySelector('.planner-dropdown[data-endpoint="origin"]')!,
      selected: null,
    },
    dest: {
      input: el.querySelector('.planner-input[data-endpoint="dest"]')!,
      dropdown: el.querySelector('.planner-dropdown[data-endpoint="dest"]')!,
      selected: null,
    },
  };

  let journeys: Journey[] = [];
  let selectedIndex: number | null = null;
  let searchTimer: number | null = null;
  let inFlight: AbortController | null = null;

  function setEndpoint(which: "origin" | "dest", location: LocationHit): void {
    const endpoint = endpoints[which];
    endpoint.selected = location;
    endpoint.input.value = location.name;
    endpoint.dropdown.hidden = true;
    void maybeSearch();
  }

  function attachAutocomplete(which: "origin" | "dest"): void {
    const endpoint = endpoints[which];
    endpoint.input.addEventListener("input", () => {
      endpoint.selected = null;
      const query = endpoint.input.value.trim();
      if (searchTimer !== null) clearTimeout(searchTimer);
      if (query.length < 2) {
        endpoint.dropdown.hidden = true;
        return;
      }
      searchTimer = window.setTimeout(async () => {
        try {
          const hits = await searchLocations(query);
          endpoint.dropdown.innerHTML = hits
            .map(
              (h, i) =>
                `<button class="planner-hit" data-index="${i}">${escapeHtml(h.name)}</button>`,
            )
            .join("");
          endpoint.dropdown.hidden = hits.length === 0;
          endpoint.dropdown.querySelectorAll(".planner-hit").forEach((btn, i) => {
            btn.addEventListener("click", () => setEndpoint(which, hits[i]));
          });
        } catch {
          endpoint.dropdown.hidden = true;
        }
      }, AUTOCOMPLETE_DEBOUNCE_MS);
    });
    endpoint.input.addEventListener("blur", () => {
      // Delay so a dropdown click can land before it hides
      setTimeout(() => (endpoint.dropdown.hidden = true), 200);
    });
  }
  attachAutocomplete("origin");
  attachAutocomplete("dest");

  el.querySelector(".planner-swap")!.addEventListener("click", () => {
    const originSelected = endpoints.origin.selected;
    const originValue = endpoints.origin.input.value;
    endpoints.origin.selected = endpoints.dest.selected;
    endpoints.origin.input.value = endpoints.dest.input.value;
    endpoints.dest.selected = originSelected;
    endpoints.dest.input.value = originValue;
    void maybeSearch();
  });

  async function maybeSearch(): Promise<void> {
    const origin = endpoints.origin.selected;
    const dest = endpoints.dest.selected;
    if (!origin || !dest || origin.gid === dest.gid) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    results.innerHTML = `<div class="dep-loading">Söker resor…</div>`;
    deselectRoute();
    try {
      journeys = await searchJourneys(origin.gid, dest.gid, controller.signal);
      renderResults();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      results.innerHTML = `<div class="dep-error">Kunde inte söka resor</div>`;
    }
  }

  function renderResults(): void {
    if (!journeys.length) {
      results.innerHTML = `<div class="dep-empty">Inga resor hittades</div>`;
      return;
    }
    results.innerHTML =
      journeys.map((j, i) => renderJourney(j, i, i === selectedIndex)).join("") +
      (selectedIndex !== null
        ? `<button class="planner-clear">Rensa rutt</button>`
        : "");
  }

  async function selectJourney(index: number): Promise<void> {
    const journey = journeys[index];
    if (!journey) return;
    selectedIndex = index;
    renderResults();
    try {
      const route = await fetchRoute(journey.details_reference);
      drawRoute(map, route);
      setActiveLines(route.line_designations);
    } catch {
      results.insertAdjacentHTML(
        "afterbegin",
        `<div class="dep-error">Kunde inte hämta rutten</div>`,
      );
    }
  }

  function deselectRoute(): void {
    selectedIndex = null;
    clearRoute(map);
    setActiveLines(null);
  }

  results.addEventListener("click", (e) => {
    const clear = (e.target as HTMLElement).closest(".planner-clear");
    if (clear) {
      deselectRoute();
      renderResults();
      return;
    }
    const card = (e.target as HTMLElement).closest<HTMLElement>(".journey-card");
    if (card) void selectJourney(Number(card.dataset.index));
  });

  function applyPicks(): void {
    const { origin, dest } = consumePicks();
    if (origin) setEndpoint("origin", origin);
    if (dest) setEndpoint("dest", dest);
  }

  let unsubscribePicks: (() => void) | null = null;
  return {
    el,
    title: "Reseplanerare",
    onMount() {
      applyPicks();
      unsubscribePicks = subscribePicks(applyPicks);
    },
    onUnmount() {
      unsubscribePicks?.();
      unsubscribePicks = null;
      inFlight?.abort();
      // Leaving the planner clears the drawn route and focus mode
      deselectRoute();
    },
  };
}
