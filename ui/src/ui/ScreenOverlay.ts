/**
 * Interactive screen overlay — appears when agent is at the desk.
 * Shows data, confirm/decline buttons for transactions.
 */

export type OverlayAction = "confirm" | "decline" | "dismiss";

export class ScreenOverlay {
  private container: HTMLElement;
  private contentEl: HTMLElement;
  private buttonsEl: HTMLElement;
  private visible = false;
  private onAction: ((action: OverlayAction) => void) | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "screen-overlay";
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: calc((100vw - 380px) / 2);
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #0d1b2a 0%, #1b2838 100%);
      border: 2px solid #FCFF52;
      border-radius: 16px;
      padding: 24px;
      min-width: 420px;
      max-width: 550px;
      color: #e0e0e0;
      font-family: 'SF Mono', 'Cascadia Code', monospace;
      font-size: 13px;
      z-index: 1000;
      display: none;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(252,255,82,0.1);
      backdrop-filter: blur(10px);
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #2a3a4a;
    `;
    const dot = document.createElement("div");
    dot.style.cssText = "width: 8px; height: 8px; background: #35D07F; border-radius: 50%;";
    header.appendChild(dot);
    const title = document.createElement("span");
    title.textContent = "ONE Agent Monitor";
    title.style.cssText = "color: #FCFF52; font-weight: 600; font-size: 14px;";
    header.appendChild(title);
    this.container.appendChild(header);

    // Content area
    this.contentEl = document.createElement("div");
    this.contentEl.style.cssText = `
      white-space: pre-wrap;
      line-height: 1.6;
      margin-bottom: 16px;
      max-height: 300px;
      overflow-y: auto;
    `;
    this.container.appendChild(this.contentEl);

    // Buttons area
    this.buttonsEl = document.createElement("div");
    this.buttonsEl.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;
    this.container.appendChild(this.buttonsEl);

    document.body.appendChild(this.container);
  }

  /** Show overlay with content and optional action buttons */
  show(content: string, options?: {
    showConfirm?: boolean;
    confirmLabel?: string;
    declineLabel?: string;
    onAction?: (action: OverlayAction) => void;
  }) {
    this.contentEl.textContent = "";

    // Parse content and colorize
    const lines = content.split("\n");
    for (const line of lines) {
      const p = document.createElement("div");
      p.style.marginBottom = "4px";

      if (line.includes("→") || line.includes("->")) {
        p.style.color = "#35D07F";
        p.style.fontWeight = "600";
      } else if (line.includes("TX:") || line.includes("celoscan")) {
        p.style.color = "#4da6ff";
      } else if (line.includes("Error") || line.includes("error")) {
        p.style.color = "#ff6b6b";
      } else if (line.includes("APY") || line.includes("%")) {
        p.style.color = "#FCFF52";
      }

      p.textContent = line;
      this.contentEl.appendChild(p);
    }

    // Clear and set buttons
    this.buttonsEl.textContent = "";
    this.onAction = options?.onAction || null;

    if (options?.showConfirm) {
      const confirmBtn = this.createButton(
        options.confirmLabel || "Confirm",
        "#35D07F", "#0a2a15",
        () => this.handleAction("confirm")
      );
      const declineBtn = this.createButton(
        options.declineLabel || "Decline",
        "#ff6b6b", "#2a0a0a",
        () => this.handleAction("decline")
      );
      this.buttonsEl.appendChild(declineBtn);
      this.buttonsEl.appendChild(confirmBtn);
    } else {
      const dismissBtn = this.createButton(
        "OK", "#666", "#1a1a1a",
        () => this.handleAction("dismiss")
      );
      this.buttonsEl.appendChild(dismissBtn);
    }

    this.container.style.display = "block";
    this.visible = true;
  }

  hide() {
    this.container.style.display = "none";
    this.visible = false;
  }

  isVisible() {
    return this.visible;
  }

  private createButton(
    text: string,
    color: string,
    bg: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 24px;
      border: 1px solid ${color};
      background: ${bg};
      color: ${color};
      border-radius: 8px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.background = color;
      btn.style.color = "#000";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = bg;
      btn.style.color = color;
    });
    btn.addEventListener("click", onClick);
    return btn;
  }

  private handleAction(action: OverlayAction) {
    this.hide();
    this.onAction?.(action);
  }
}
