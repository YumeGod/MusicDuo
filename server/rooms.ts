import type { WebSocket } from 'ws';
import {
  roomCode,
  validRoomCode,
  validRemotePacket,
  type RemoteRole,
} from '../src/multiplayer/remoteProtocol';
interface Member {
  code: string;
  role: RemoteRole;
}
export class RoomHub {
  private rooms = new Map<string, { host: WebSocket; guest?: WebSocket }>();
  private members = new Map<WebSocket, Member>();
  private send(socket: WebSocket, data: unknown) {
    if (socket.readyState === 1 && socket.bufferedAmount < 256_000)
      socket.send(JSON.stringify(data));
  }
  receive(socket: WebSocket, raw: string) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return this.send(socket, { type: 'error', message: 'Invalid message.' });
    }
    if (!data || typeof data !== 'object') return;
    const member = this.members.get(socket);
    if (!member) {
      if (
        data.type !== 'join' ||
        typeof data.code !== 'string' ||
        !['host', 'guest'].includes(data.role)
      )
        return;
      const code = roomCode(data.code);
      if (!validRoomCode(code))
        return this.send(socket, {
          type: 'error',
          message: 'Use 4–32 letters, numbers, underscores or hyphens.',
        });
      const room = this.rooms.get(code);
      if (data.role === 'host') {
        if (room)
          return this.send(socket, {
            type: 'error',
            message: 'That room already has a host. Choose another code.',
          });
        this.rooms.set(code, { host: socket });
      } else {
        if (!room)
          return this.send(socket, {
            type: 'error',
            message: 'Room not found. Ask the host to create it first.',
          });
        if (room.guest)
          return this.send(socket, {
            type: 'error',
            message: 'This room already has two players.',
          });
        room.guest = socket;
      }
      this.members.set(socket, { code, role: data.role });
      this.send(socket, { type: 'joined', role: data.role, code });
      const active = this.rooms.get(code)!;
      if (active.guest) {
        this.send(active.host, { type: 'peer-ready' });
        this.send(active.guest, { type: 'peer-ready' });
      }
      return;
    }
    if (!validRemotePacket(data)) return;
    if (
      (member.role === 'guest' && data.type === 'world') ||
      (member.role === 'host' && ['objects', 'global'].includes(data.type))
    )
      return;
    if (
      data.type === 'signal' &&
      data.description &&
      data.description.type !== (member.role === 'host' ? 'offer' : 'answer')
    )
      return;
    const room = this.rooms.get(member.code);
    const peer = member.role === 'host' ? room?.guest : room?.host;
    if (peer) this.send(peer, data);
  }
  leave(socket: WebSocket) {
    const m = this.members.get(socket);
    if (!m) return;
    this.members.delete(socket);
    const room = this.rooms.get(m.code);
    if (!room) return;
    if (m.role === 'host') {
      this.rooms.delete(m.code);
      if (room.guest) {
        this.members.delete(room.guest);
        this.send(room.guest, { type: 'host-left' });
        room.guest.close(1000, 'Host left');
      }
    } else {
      room.guest = undefined;
      this.send(room.host, { type: 'peer-left' });
    }
  }
}
