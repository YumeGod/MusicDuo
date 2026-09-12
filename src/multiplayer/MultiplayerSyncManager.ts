import type { NetworkControlMessage } from './protocol';
import { validMessage } from './protocol';
export class MultiplayerSyncManager {
  private channel?: BroadcastChannel;
  private socket?: WebSocket;
  private lastSent = new Map<string, number>();
  private timestamps = new Map<string, number>();
  playerId = crypto.randomUUID();
  sessionId = '';
  connect(
    sessionId: string,
    onMessage: (message: NetworkControlMessage) => void,
    url?: string,
    onStatus?: (s: string) => void,
  ) {
    this.disconnect();
    this.sessionId = sessionId;
    const receive = (data: unknown) => {
      if (
        !validMessage(data) ||
        data.sessionId !== sessionId ||
        data.playerId === this.playerId ||
        Date.now() - data.timestamp > 3000 ||
        data.timestamp > Date.now() + 5000 ||
        data.timestamp <= (this.timestamps.get(data.playerId + data.role) ?? 0)
      )
        return;
      this.timestamps.set(data.playerId + data.role, data.timestamp);
      onMessage(data);
    };
    if (url) {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => onStatus?.('Connected');
      this.socket.onclose = () => onStatus?.('Disconnected');
      this.socket.onerror = () => onStatus?.('Connection failed');
      this.socket.onmessage = (e) => {
        try {
          receive(JSON.parse(e.data));
        } catch {
          /* Ignore malformed peers. */
        }
      };
    } else {
      this.channel = new BroadcastChannel('musicduo:' + sessionId);
      this.channel.onmessage = (e) => receive(e.data);
      onStatus?.('Local room ready');
    }
  }
  send(
    message: Omit<
      NetworkControlMessage,
      'playerId' | 'timestamp' | 'version' | 'sessionId'
    >,
  ) {
    const now = Date.now();
    if (now - (this.lastSent.get(message.role) ?? 0) < 50) return;
    this.lastSent.set(message.role, now);
    const data = {
      ...message,
      version: 1,
      sessionId: this.sessionId,
      playerId: this.playerId,
      timestamp: now,
    };
    this.channel?.postMessage(data);
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(data));
  }
  disconnect() {
    this.channel?.close();
    this.socket?.close();
    this.channel = undefined;
    this.socket = undefined;
    this.timestamps.clear();
  }
}
