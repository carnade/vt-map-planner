export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const MODE_LABELS: Record<string, string> = {
  tram: "Spårvagn",
  bus: "Buss",
  train: "Tåg",
  ferry: "Färja",
  taxi: "Taxi",
};
