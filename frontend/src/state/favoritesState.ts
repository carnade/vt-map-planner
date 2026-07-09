export interface FavoriteStop {
  gid: string;
  name: string;
}

const STORAGE_KEY = "busplanner.favorites.v1";

type Listener = () => void;

let favorites: FavoriteStop[] = [];
const listeners = new Set<Listener>();

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  if (Array.isArray(stored)) {
    favorites = stored.filter(
      (f) => f && typeof f.gid === "string" && typeof f.name === "string",
    );
  }
} catch {
  // Corrupt persisted state — start fresh
}

function notify(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage unavailable — favorites just won't persist
  }
  for (const fn of listeners) fn();
}

export function subscribeFavorites(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFavorites(): FavoriteStop[] {
  return [...favorites];
}

export function isFavorite(gid: string): boolean {
  return favorites.some((f) => f.gid === gid);
}

export function toggleFavorite(stop: FavoriteStop): void {
  if (isFavorite(stop.gid)) {
    favorites = favorites.filter((f) => f.gid !== stop.gid);
  } else {
    favorites = [...favorites, stop];
  }
  notify();
}
