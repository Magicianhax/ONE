export type WSMessage =
  | { type: "action_start"; action: string; target: string; params?: Record<string, string> }
  | { type: "action_result"; action: string; data: any; message: string }
  | { type: "action_error"; message: string }
  | { type: "action_approval"; action: string; message: string; data?: any }
  | { type: "chat_response"; message: string };

type MessageHandler = (msg: WSMessage) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private url: string;
  private queue: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[ws] connected");
      // Flush queued messages
      for (const msg of this.queue) {
        this.ws!.send(msg);
      }
      this.queue = [];
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch (e) {
        console.error("[ws] bad message:", event.data);
      }
    };

    this.ws.onclose = () => {
      console.log("[ws] disconnected, reconnecting in 2s...");
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = (err) => {
      console.error("[ws] error:", err);
    };
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
  }

  send(message: string) {
    const payload = JSON.stringify({ type: "chat", message });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload);
    }
  }

  sendRaw(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.queue.push(data);
    }
  }
}
