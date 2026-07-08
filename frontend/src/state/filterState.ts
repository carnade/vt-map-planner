import type { Vehicle } from "../types/vehicle";

export const ALL_MODES = ["tram", "bus", "ferry", "train", "taxi"] as const;
export type Mode = (typeof ALL_MODES)[number];

export interface SeenLine {
  line: string;
  mode: Mode;
  bg_color: string | null;
  fg_color: string | null;
}

const FILTERS_KEY = "busplanner.filters.v1";
const SEEN_LINES_KEY = "busplanner.seenLines.v1";
const MAX_SEEN_LINES = 500;

type Listener = () => void;

const enabledModes: Record<Mode, boolean> = {
  tram: true,
  bus: true,
  ferry: true,
  train: true,
  taxi: true,
};
// Disabled (not enabled) lines are stored so newly seen lines default to visible
const disabledLines = new Set<string>();
const seenLines = new Map<string, SeenLine>();
const listeners = new Set<Listener>();
const filterListeners = new Set<Listener>();

function lineKey(mode: string, line: string): string {
  return `${mode}:${line}`;
}

function isMode(value: string): value is Mode {
  return (ALL_MODES as readonly string[]).includes(value);
}

function persist(): void {
  try {
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ enabledModes, disabledLines: [...disabledLines] }),
    );
    localStorage.setItem(SEEN_LINES_KEY, JSON.stringify([...seenLines.values()]));
  } catch {
    // localStorage full or unavailable — filters just won't persist
  }
}

function restore(): void {
  try {
    const filters = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "null");
    if (filters?.enabledModes) {
      for (const mode of ALL_MODES) {
        if (typeof filters.enabledModes[mode] === "boolean") {
          enabledModes[mode] = filters.enabledModes[mode];
        }
      }
    }
    if (Array.isArray(filters?.disabledLines)) {
      for (const key of filters.disabledLines) {
        if (typeof key === "string") disabledLines.add(key);
      }
    }
    const seen = JSON.parse(localStorage.getItem(SEEN_LINES_KEY) ?? "null");
    if (Array.isArray(seen)) {
      for (const entry of seen) {
        if (entry && typeof entry.line === "string" && isMode(entry.mode)) {
          seenLines.set(lineKey(entry.mode, entry.line), entry);
        }
      }
    }
  } catch {
    // Corrupt persisted state — start fresh
  }
}
restore();

function notify(filtersChanged: boolean): void {
  persist();
  for (const fn of listeners) fn();
  if (filtersChanged) {
    for (const fn of filterListeners) fn();
  }
}

/** Fires on any change, including newly seen lines (for the filter panel UI) */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fires only when mode/line visibility changes (for the data path) */
export function subscribeFilters(fn: Listener): () => void {
  filterListeners.add(fn);
  return () => filterListeners.delete(fn);
}

export function getEnabledModes(): Mode[] {
  return ALL_MODES.filter((m) => enabledModes[m]);
}

export function isModeEnabled(mode: Mode): boolean {
  return enabledModes[mode];
}

export function setModeEnabled(mode: Mode, on: boolean): void {
  if (enabledModes[mode] === on) return;
  enabledModes[mode] = on;
  notify(true);
}

export function isLineEnabled(mode: string, line: string): boolean {
  return !disabledLines.has(lineKey(mode, line));
}

export function setLineEnabled(mode: string, line: string, on: boolean): void {
  const key = lineKey(mode, line);
  const changed = on ? disabledLines.delete(key) : !disabledLines.has(key);
  if (!on) disabledLines.add(key);
  if (changed) notify(true);
}

export function setAllLinesEnabled(mode: Mode, on: boolean): void {
  let changed = false;
  for (const seen of seenLines.values()) {
    if (seen.mode !== mode) continue;
    const key = lineKey(seen.mode, seen.line);
    if (on && disabledLines.delete(key)) changed = true;
    if (!on && !disabledLines.has(key)) {
      disabledLines.add(key);
      changed = true;
    }
  }
  if (changed) notify(true);
}

export function getSeenLines(mode: Mode): SeenLine[] {
  const lines = [...seenLines.values()].filter((s) => s.mode === mode);
  return lines.sort((a, b) =>
    a.line.localeCompare(b.line, "sv", { numeric: true }),
  );
}

export function recordSeen(vehicles: Vehicle[]): void {
  let added = false;
  for (const v of vehicles) {
    if (!isMode(v.mode)) continue;
    const key = lineKey(v.mode, v.line);
    if (!seenLines.has(key) && seenLines.size < MAX_SEEN_LINES) {
      seenLines.set(key, {
        line: v.line,
        mode: v.mode,
        bg_color: v.bg_color,
        fg_color: v.fg_color,
      });
      added = true;
    }
  }
  if (added) notify(false);
}

export function vehiclePassesFilter(v: Vehicle): boolean {
  if (isMode(v.mode) && !enabledModes[v.mode]) return false;
  return isLineEnabled(v.mode, v.line);
}
