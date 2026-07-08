import { VEHICLE_CAP } from "../config";

let el: HTMLElement | null = null;

function ensureElement(): HTMLElement {
  if (!el) {
    el = document.createElement("div");
    el.id = "cap-warning";
    el.textContent = `Max ${VEHICLE_CAP} fordon visas samtidigt — zooma in för att se alla`;
    el.hidden = true;
    document.body.append(el);
  }
  return el;
}

export function setCapWarningVisible(visible: boolean): void {
  ensureElement().hidden = !visible;
}

export function removeCapWarning(): void {
  el?.remove();
  el = null;
}
