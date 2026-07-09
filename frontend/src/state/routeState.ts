import type { LocationHit } from "../types/journey";
import type { Vehicle } from "../types/vehicle";

type Listener = () => void;

// Lines belonging to the currently drawn route (focus mode), or null when none
let activeLines: Set<string> | null = null;
// Origin/destination picked from the map (long-press), consumed by the planner
let pendingOrigin: LocationHit | null = null;
let pendingDest: LocationHit | null = null;

const listeners = new Set<Listener>();
const pickListeners = new Set<Listener>();

function notify(set: Set<Listener>): void {
  for (const fn of set) fn();
}

/** Fires when focus mode (active route lines) changes — used by the poller */
export function subscribeRoute(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fires when a map pick (from/to) happens — used by the planner view */
export function subscribePicks(fn: Listener): () => void {
  pickListeners.add(fn);
  return () => pickListeners.delete(fn);
}

export function setActiveLines(lines: string[] | null): void {
  activeLines = lines ? new Set(lines) : null;
  notify(listeners);
}

export function isFocusActive(): boolean {
  return activeLines !== null;
}

export function getActiveLines(): string[] {
  return activeLines ? [...activeLines] : [];
}

export function vehicleOnRoute(v: Vehicle): boolean {
  return activeLines === null || activeLines.has(v.line);
}

export function pickOrigin(location: LocationHit): void {
  pendingOrigin = location;
  notify(pickListeners);
}

export function pickDest(location: LocationHit): void {
  pendingDest = location;
  notify(pickListeners);
}

export function consumePicks(): {
  origin: LocationHit | null;
  dest: LocationHit | null;
} {
  return { origin: pendingOrigin, dest: pendingDest };
}
