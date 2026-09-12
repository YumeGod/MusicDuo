import {
  validRemotePacket,
  roomCode,
  validRoomCode,
  type RemotePacket,
  type RemoteRole,
} from './remoteProtocol';
export class RemoteSessionManager {
  role?: RemoteRole;
  connected = false;
  peerPresent = false;
  status = 'Not connected';
  remoteStream?: MediaStream;
  onChange = () => {};
  onPacket = (_packet: RemotePacket) => {};
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private video?: MediaStreamTrack;
  private audio?: MediaStreamTrack;
  private videoSender?: RTCRtpSender;
  private audioSender?: RTCRtpSender;
  private candidates: RTCIceCandidateInit[] = [];
  private queue = Promise.resolve();
  private lastGlobal = 0;
  private timeout?: ReturnType<typeof setTimeout>;
  connect(role: RemoteRole, code: string) {
    this.disconnect();
    code = roomCode(code);
    if (!validRoomCode(code)) {
      this.status =
        'Use a room code of 4–32 letters, numbers, underscores or hyphens.';
      this.onChange();
      return;
    }
    this.role = role;
    this.status = 'Connecting to the LAN host…';
    this.onChange();
    const ws = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/room`,
    );
    this.socket = ws;
    this.timeout = setTimeout(() => {
      if (!this.connected && this.socket === ws) {
        this.status =
          'LAN server unavailable. Open the host’s LAN URL, then try again.';
        ws.close();
        this.onChange();
      }
    }, 7000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', role, code }));
    ws.onerror = () => {
      this.status =
        'Could not reach the LAN room server. Open the host’s LAN URL.';
      this.onChange();
    };
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.connected = false;
      this.closePeer();
      clearTimeout(this.timeout);
      if (
        !this.status.includes('unavailable') &&
        !this.status.includes('Could not') &&
        !this.status.includes('left')
      )
        this.status = 'Room disconnected. Rejoin to reconnect.';
      this.onChange();
    };
    ws.onmessage = (e) => {
      this.queue = this.queue
        .then(async () => {
          if (this.socket !== ws) return;
          const data = JSON.parse(e.data);
          if (data.type === 'joined') {
            clearTimeout(this.timeout);
            this.connected = true;
            this.status =
              role === 'host'
                ? `Hosting ${code} · waiting for guest`
                : `Joined ${code}`;
            this.onChange();
          } else if (data.type === 'error') {
            clearTimeout(this.timeout);
            this.status = data.message;
            this.onChange();
          } else if (data.type === 'peer-ready') {
            this.peerPresent = true;
            this.status = 'Partner joined · connecting video';
            this.makePeer();
            if (role === 'host') {
              await this.peer!.setLocalDescription(
                await this.peer!.createOffer(),
              );
              this.send({
                type: 'signal',
                description: this.peer!.localDescription!.toJSON(),
              });
            }
            this.onChange();
          } else if (data.type === 'peer-left' || data.type === 'host-left') {
            this.closePeer();
            this.status =
              data.type === 'host-left'
                ? 'Host left · audio stopped'
                : 'Guest left · waiting for a new guest';
            this.onChange();
          } else if (validRemotePacket(data)) {
            if (data.type === 'signal') await this.signal(data);
            else this.onPacket(data);
          }
        })
        .catch(() => {
          if (this.socket === ws) {
            this.status =
              'Partner video could not connect. Leave and rejoin the room.';
            this.onChange();
          }
        });
    };
  }
  private makePeer() {
    this.closePeer();
    this.peerPresent = true;
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.peer = pc;
    this.remoteStream = new MediaStream();
    this.videoSender = pc.addTransceiver('video', {
      direction: 'sendrecv',
    }).sender;
    this.audioSender = pc.addTransceiver('audio', {
      direction: this.role === 'host' ? 'sendonly' : 'recvonly',
    }).sender;
    if (this.video) void this.videoSender.replaceTrack(this.video);
    if (this.role === 'host' && this.audio)
      void this.audioSender.replaceTrack(this.audio);
    pc.onicecandidate = (e) => {
      if (e.candidate && this.peer === pc)
        this.send({ type: 'signal', candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      if (this.peer !== pc) return;
      this.remoteStream!.addTrack(e.track);
      this.onChange();
    };
    pc.onconnectionstatechange = () => {
      if (this.peer !== pc) return;
      this.status =
        pc.connectionState === 'connected'
          ? 'Partner connected · host audio'
          : pc.connectionState === 'failed'
            ? 'Video connection failed. Check Wi-Fi client isolation and rejoin.'
            : `Partner video · ${pc.connectionState}`;
      this.onChange();
    };
  }
  private async signal(p: Extract<RemotePacket, { type: 'signal' }>) {
    const pc = this.peer;
    if (!pc) return;
    if (p.description) {
      await pc.setRemoteDescription(p.description);
      for (const c of this.candidates) await pc.addIceCandidate(c);
      this.candidates = [];
      if (p.description.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({
          type: 'signal',
          description: pc.localDescription!.toJSON(),
        });
      }
    } else if (p.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(p.candidate);
      else this.candidates.push(p.candidate);
    }
  }
  setMedia(video?: MediaStream, audio?: MediaStream) {
    this.video = video?.getVideoTracks()[0];
    this.audio = audio?.getAudioTracks()[0];
    void this.videoSender?.replaceTrack(this.video ?? null).catch(() => {});
    if (this.role === 'host')
      void this.audioSender?.replaceTrack(this.audio ?? null).catch(() => {});
  }
  send(packet: RemotePacket) {
    if (packet.type === 'global') {
      const now = performance.now();
      if (now - this.lastGlobal < 50) return;
      this.lastGlobal = now;
    }
    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.connected &&
      this.peerPresent &&
      this.socket.bufferedAmount < 128000
    )
      this.socket.send(JSON.stringify(packet));
  }
  private closePeer() {
    this.peer?.close();
    this.peer = undefined;
    this.videoSender = undefined;
    this.audioSender = undefined;
    this.remoteStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream = undefined;
    this.peerPresent = false;
    this.candidates = [];
  }
  disconnect() {
    clearTimeout(this.timeout);
    const ws = this.socket;
    this.socket = undefined;
    ws?.close();
    this.closePeer();
    this.role = undefined;
    this.connected = false;
    this.status = 'Not connected';
    this.lastGlobal = 0;
    this.onChange();
  }
}
