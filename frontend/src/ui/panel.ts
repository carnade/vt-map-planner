import { PANEL_BREAKPOINT_PX } from "../config";

export interface PanelView {
  el: HTMLElement;
  title: string;
  onMount?(): void;
  onUnmount?(): void;
}

export type SheetState = "peek" | "half" | "full";

const SHEET_HEIGHTS: Record<SheetState, number> = {
  peek: 0.08,
  half: 0.5,
  full: 0.92,
};

export class Panel {
  private root: HTMLElement;
  private headerTitle: HTMLElement;
  private backButton: HTMLButtonElement;
  private content: HTMLElement;
  private handle: HTMLElement;
  private peekBar: HTMLElement;
  private toggleButton: HTMLButtonElement;
  private stack: PanelView[] = [];
  private isDesktop: boolean;
  private sheetState: SheetState = "peek";
  private collapsed = false;

  constructor() {
    this.isDesktop = window.innerWidth >= PANEL_BREAKPOINT_PX;

    this.root = document.createElement("div");
    this.root.id = "panel";

    this.handle = document.createElement("div");
    this.handle.className = "panel-handle";
    this.handle.innerHTML = `<div class="panel-handle-bar"></div>`;

    this.peekBar = document.createElement("div");
    this.peekBar.className = "panel-peek-bar";

    const header = document.createElement("div");
    header.className = "panel-header";
    this.backButton = document.createElement("button");
    this.backButton.className = "panel-back";
    this.backButton.textContent = "‹";
    this.backButton.setAttribute("aria-label", "Tillbaka");
    this.backButton.addEventListener("click", () => this.pop());
    this.headerTitle = document.createElement("div");
    this.headerTitle.className = "panel-title";
    const closeButton = document.createElement("button");
    closeButton.className = "panel-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Stäng panel");
    closeButton.addEventListener("click", () => {
      if (this.isDesktop) {
        this.setCollapsed(true);
      } else {
        this.setSheetState("peek");
      }
    });
    header.append(this.backButton, this.headerTitle, closeButton);

    this.content = document.createElement("div");
    this.content.className = "panel-content";

    this.root.append(this.handle, this.peekBar, header, this.content);
    document.body.append(this.root);

    this.toggleButton = document.createElement("button");
    this.toggleButton.id = "panel-toggle";
    this.toggleButton.innerHTML = "☰";
    this.toggleButton.setAttribute("aria-label", "Visa panel");
    this.toggleButton.addEventListener("click", () => {
      if (this.isDesktop) {
        this.setCollapsed(!this.collapsed);
      } else {
        this.setSheetState(this.sheetState === "peek" ? "half" : "peek");
      }
    });
    document.body.append(this.toggleButton);

    this.attachSheetDrag();

    const mq = window.matchMedia(`(min-width: ${PANEL_BREAKPOINT_PX}px)`);
    mq.addEventListener("change", (e) => {
      this.isDesktop = e.matches;
      this.applyLayout();
    });

    this.applyLayout();
  }

  setRoot(view: PanelView): void {
    for (const v of this.stack) v.onUnmount?.();
    this.stack = [view];
    this.renderTop();
    view.onMount?.();
  }

  push(view: PanelView): void {
    this.stack.push(view);
    this.renderTop();
    view.onMount?.();
  }

  pop(): void {
    if (this.stack.length <= 1) return;
    const view = this.stack.pop();
    view?.onUnmount?.();
    this.renderTop();
  }

  /** Replace the top view if it's not the root (used to swap departure boards) */
  replaceTop(view: PanelView): void {
    if (this.stack.length > 1) {
      const old = this.stack.pop();
      old?.onUnmount?.();
    }
    this.stack.push(view);
    this.renderTop();
    view.onMount?.();
  }

  /** Content shown in the bottom sheet's collapsed (peek) strip on mobile */
  setPeekContent(el: HTMLElement): void {
    this.peekBar.replaceChildren(el);
  }

  topView(): PanelView | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  open(): void {
    if (this.isDesktop) {
      this.setCollapsed(false);
    } else if (this.sheetState === "peek") {
      this.setSheetState("half");
    }
  }

  destroy(): void {
    for (const v of this.stack) v.onUnmount?.();
    this.root.remove();
    this.toggleButton.remove();
  }

  private renderTop(): void {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    this.headerTitle.textContent = top.title;
    this.backButton.style.display = this.stack.length > 1 ? "" : "none";
    this.content.replaceChildren(top.el);
    this.content.scrollTop = 0;
  }

  private applyLayout(): void {
    this.root.classList.toggle("panel-desktop", this.isDesktop);
    this.root.classList.toggle("panel-sheet", !this.isDesktop);
    if (this.isDesktop) {
      this.root.style.transform = "";
      this.root.classList.remove("panel-peek");
      this.setCollapsed(this.collapsed);
    } else {
      this.root.classList.remove("panel-collapsed");
      this.setSheetState(this.sheetState);
    }
  }

  private setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.root.classList.toggle("panel-collapsed", collapsed);
    this.toggleButton.classList.toggle("panel-toggle-visible", collapsed);
  }

  private setSheetState(state: SheetState): void {
    this.sheetState = state;
    const height = SHEET_HEIGHTS[state] * window.innerHeight;
    this.root.style.transition = "transform 0.25s ease-out";
    this.root.style.transform = `translateY(${window.innerHeight - height}px)`;
    this.root.classList.toggle("panel-peek", state === "peek");
    this.toggleButton.classList.remove("panel-toggle-visible");
  }

  private attachSheetDrag(): void {
    let startY = 0;
    let startTranslate = 0;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      if (this.isDesktop) return;
      dragging = true;
      startY = e.clientY;
      const match = /translateY\(([-\d.]+)px\)/.exec(this.root.style.transform);
      startTranslate = match ? parseFloat(match[1]) : 0;
      this.root.style.transition = "none";
      this.handle.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const translate = Math.max(
        window.innerHeight * (1 - SHEET_HEIGHTS.full),
        startTranslate + (e.clientY - startY),
      );
      this.root.style.transform = `translateY(${translate}px)`;
    };
    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      const match = /translateY\(([-\d.]+)px\)/.exec(this.root.style.transform);
      const translate = match ? parseFloat(match[1]) : 0;
      const shown = 1 - translate / window.innerHeight;
      let nearest: SheetState = "peek";
      let best = Infinity;
      for (const [state, height] of Object.entries(SHEET_HEIGHTS)) {
        const diff = Math.abs(shown - height);
        if (diff < best) {
          best = diff;
          nearest = state as SheetState;
        }
      }
      this.setSheetState(nearest);
    };

    this.handle.addEventListener("pointerdown", onPointerDown);
    this.handle.addEventListener("pointermove", onPointerMove);
    this.handle.addEventListener("pointerup", onPointerUp);
    this.handle.addEventListener("pointercancel", onPointerUp);
  }
}
