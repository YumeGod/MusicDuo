import type {
  NetworkControlMessage,
  PresenceMessage,
  WorldMessage,
} from './protocol';
import type { WorldSyncSnapshot } from '../types';
import { validEnvelope } from './protocol';
import { WorldAuthority } from './WorldAuthority';
export class MultiplayerSyncManager {
  private channel?: BroadcastChannel;
  private socket?: WebSocket;
  private lastSent = new Map<string, number>();
  private timestamps = new Map<string, number>();
  private heartbeat?: ReturnType<typeof setInterval>;
  private latestWorld?: WorldSyncSnapshot;
  private onAuthority?: (authority: boolean) => void;
  private wasAuthority = true;
  playerId = crypto.randomUUID();
  sessionId = '';
  connected = false;
  priority = () => 1;
  private election = new WorldAuthority(this.playerId, () => this.priority());
  isAuthority() {
    return (
      !this.connected || this.election.leader(Date.now()) === this.playerId
    );
  }
  private publish(data: unknown) {
    this.channel?.postMessage(data);
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(data));
  }
  private authorityChanged() {
    const current = this.isAuthority();
    if (current !== this.wasAuthority) {
      this.wasAuthority = current;
      this.onAuthority?.(current);
    }
    return current;
  }
  connect(
    sessionId: string,
    onMessage: (message: NetworkControlMessage) => void,
    url?: string,
    onStatus?: (s: string) => void,
    onWorld?: (s: WorldSyncSnapshot) => void,
    onAuthority?: (authority: boolean) => void,
  ) {
    this.disconnect();
    this.sessionId = sessionId;
    this.connected = true;
    this.onAuthority = onAuthority;
    const receive = (data: unknown) => {
      if (
        !validEnvelope(data) ||
        data.sessionId !== sessionId ||
        data.playerId === this.playerId ||
        Date.now() - data.timestamp > 3000 ||
        data.timestamp > Date.now() + 5000
      )
        return;
      const kind = 'kind' in data ? data.kind : 'controls',
        key = data.playerId + kind + ('role' in data ? data.role : '');
      if (data.timestamp <= (this.timestamps.get(key) ?? 0)) return;
      this.timestamps.set(key, data.timestamp);
      if ('kind' in data && data.kind === 'presence') {
        this.election.observe(data.playerId, data.priority, Date.now());
        if (this.authorityChanged() && this.latestWorld)
          this.sendWorld(this.latestWorld);
        return;
      }
      if ('kind' in data && data.kind === 'world') {
        if (
          data.playerId === this.election.leader(Date.now()) &&
          !this.isAuthority()
        ) {
          this.latestWorld = data.snapshot;
          onWorld?.(data.snapshot);
        }
        return;
      }
      onMessage(data as NetworkControlMessage);
    };
    const pulse = () => {
      const message: PresenceMessage = {
        version: 1,
        kind: 'presence',
        playerId: this.playerId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        priority: this.priority(),
      };
      this.publish(message);
      if (this.authorityChanged() && this.latestWorld)
        this.sendWorld(this.latestWorld);
    };
    if (url) {
      this.socket = new WebSocket(url);
      this.socket.onopen = () => {
        onStatus?.('Connected');
        pulse();
      };
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
      pulse();
    }
    this.heartbeat = setInterval(pulse, 1000);
  }
  sendWorld(snapshot: WorldSyncSnapshot) {
    if (!this.connected || !this.isAuthority()) return;
    this.latestWorld = structuredClone(snapshot);
    const message: WorldMessage = {
      version: 1,
      kind: 'world',
      playerId: this.playerId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      snapshot: this.latestWorld,
    };
    this.publish(message);
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
    this.publish({
      ...message,
      version: 1,
      sessionId: this.sessionId,
      playerId: this.playerId,
      timestamp: now,
    });
  }
  disconnect() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.channel?.close();
    this.socket?.close();
    this.channel = undefined;
    this.socket = undefined;
    this.timestamps.clear();
    this.lastSent.clear();
    this.election.clear();
    this.latestWorld = undefined;
    this.connected = false;
    this.wasAuthority = true;
    this.onAuthority = undefined;
  }
}
