import { WSClient } from "../ws.js";

// ── Markdown-to-DOM renderer (safe, no innerHTML) ──

function renderMarkdown(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Detect table: line starts with |
    if (lines[i].trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        frag.appendChild(buildTable(tableLines));
      }
      continue;
    }

    // Normal line
    if (frag.childNodes.length > 0) {
      frag.appendChild(document.createElement("br"));
    }
    const parts = parseInline(lines[i]);
    for (const part of parts) {
      frag.appendChild(part);
    }
    i++;
  }
  return frag;
}

function buildTable(lines: string[]): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "chat-table";

  // Parse header row
  const headerCells = parsePipeLine(lines[0]);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const cell of headerCells) {
    const th = document.createElement("th");
    th.appendChild(parseInlineFragment(cell.trim()));
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Skip separator row (|---|---|)
  let startRow = 1;
  if (lines.length > 1 && /^\|[\s\-:|]+\|$/.test(lines[1])) {
    startRow = 2;
  }

  // Data rows
  const tbody = document.createElement("tbody");
  for (let r = startRow; r < lines.length; r++) {
    const cells = parsePipeLine(lines[r]);
    const tr = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      td.appendChild(parseInlineFragment(cell.trim()));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function parsePipeLine(line: string): string[] {
  // Split by | but ignore leading/trailing
  const trimmed = line.replace(/^\||\|$/g, "");
  return trimmed.split("|");
}

function parseInlineFragment(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const node of parseInline(text)) {
    frag.appendChild(node);
  }
  return frag;
}

function parseInline(text: string): Node[] {
  const nodes: Node[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    if (match[1] && match[2]) {
      const a = document.createElement("a");
      a.href = match[2];
      a.textContent = match[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      nodes.push(a);
    } else if (match[3]) {
      const b = document.createElement("strong");
      b.textContent = match[3];
      nodes.push(b);
    } else if (match[4]) {
      const em = document.createElement("em");
      em.textContent = match[4];
      nodes.push(em);
    } else if (match[5]) {
      const code = document.createElement("code");
      code.textContent = match[5];
      nodes.push(code);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(document.createTextNode(text.slice(lastIndex)));
  }
  if (nodes.length === 0) {
    nodes.push(document.createTextNode(text));
  }
  return nodes;
}

export class ChatPanel {
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private suggestionsEl: HTMLElement;
  private ws: WSClient;

  constructor(ws: WSClient) {
    this.ws = ws;
    this.messagesEl = document.getElementById("messages")!;
    this.inputEl = document.getElementById("chat-input") as HTMLTextAreaElement;
    this.suggestionsEl = document.getElementById("suggestions")!;
    const sendBtn = document.getElementById("send-btn")!;

    sendBtn.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    this.inputEl.addEventListener("input", () => {
      this.inputEl.style.height = "auto";
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 100) + "px";
    });

    this.suggestionsEl.querySelectorAll(".suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const msg = (chip as HTMLElement).dataset.msg;
        if (msg) {
          this.inputEl.value = msg;
          this.handleSend();
        }
      });
    });
  }

  private handleSend() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.addMessage(text, "user");
    this.ws.send(text);
    this.inputEl.value = "";
    this.inputEl.style.height = "auto";
    this.showTyping();
    this.suggestionsEl.style.display = "none";
  }

  addMessage(text: string, role: "user" | "agent" | "system") {
    this.hideTyping();
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    if (role === "user") {
      div.textContent = text;
    } else {
      div.appendChild(renderMarkdown(text));
    }
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  showTyping() {
    this.hideTyping();
    const div = document.createElement("div");
    div.className = "msg agent typing-indicator";
    div.id = "typing";
    for (let i = 0; i < 3; i++) {
      div.appendChild(document.createElement("span"));
    }
    this.messagesEl.appendChild(div);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
  }
}
