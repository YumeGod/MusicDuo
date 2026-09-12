import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomHub } from '../server/rooms';
import {
  guestVoices,
  validRemotePacket,
  validRoomCode,
  roomCode,
} from '../src/multiplayer/remoteProtocol';
import { ObjectTracker } from '../src/vision/ObjectTracker';
import { manualWorld } from '../src/audio/manualTonality';
import { ChordProgressionEngine } from '../src/audio/ChordProgressionEngine';
import { SCALES, NOTE_NAMES, scaleMidiNotes } from '../src/audio/harmony';
void test('custom room codes normalize and reject empty or malformed codes', () => {
  assert.equal(roomCode(' duet-22 '), 'DUET-22');
  assert.ok(validRoomCode('DUET-22'));
  for (const code of ['', 'a', 'duet', 'MY ROOM', '../room'])
    assert.equal(validRoomCode(code), false);
});
void test('guest objects stay independent, bounded and owned by host transport', () => {
  const t = new ObjectTracker(),
    o = t.create(
      {
        label: 'bottle',
        confidence: 1,
        bbox: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
      },
      100,
    );
  assert.ok(validRemotePacket({ type: 'objects', objects: [o] }));
  const voice = guestVoices([o], 200)[0];
  assert.notEqual(voice.id, o.id);
  assert.equal(voice.id, `guest:${o.id}`);
  assert.equal(voice.selectedBy, undefined);
  assert.equal(voice.lastSeen, 200);
  assert.equal(
    validRemotePacket({ type: 'objects', objects: [{ ...o, volume: NaN }] }),
    false,
  );
  assert.equal(
    validRemotePacket({
      type: 'objects',
      objects: [{ ...o, instrumentId: 'unknown' }],
    }),
    false,
  );
  assert.equal(validRemotePacket({ type: 'objects', objects: [o, o] }), false);
});
void test('every custom key type stays coherent and switches at a phrase boundary', () => {
  for (const key of NOTE_NAMES)
    for (const scale of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
      const h = new ChordProgressionEngine(),
        w = manualWorld(h.world, key, scale);
      h.requestWorld(w);
      h.advance(4);
      assert.equal(h.world.scale, 'ionian');
      const state = h.advance(16);
      assert.equal(state.scale, scale);
      assert.equal(state.key, key);
      assert.deepEqual(state.scaleNotes, scaleMidiNotes(key, scale, 36, 84));
    }
  assert.equal(
    manualWorld(new ChordProgressionEngine().world, 'D', 'harmonic_minor')
      .quality,
    'minor',
  );
  assert.equal(
    manualWorld(new ChordProgressionEngine().world, 'D', 'dorian').quality,
    'modal',
  );
});
void test('real WebSocket rooms enforce host ownership, room isolation and guest lifecycle', async () => {
  const hub = new RoomHub(),
    server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  server.on('connection', (ws) => {
    ws.on('message', (raw) =>
      hub.receive(
        ws,
        (Array.isArray(raw)
          ? Buffer.concat(raw)
          : Buffer.isBuffer(raw)
            ? raw
            : Buffer.from(raw)
        ).toString('utf8'),
      ),
    );
    ws.on('close', () => hub.leave(ws));
  });
  const address = server.address();
  assert.ok(typeof address === 'object' && address);
  const url = `ws://127.0.0.1:${address.port}`;
  const clients: WebSocket[] = [];
  async function client() {
    const ws = new WebSocket(url);
    clients.push(ws);
    await once(ws, 'open');
    const messages: Record<string, unknown>[] = [];
    ws.on('message', (raw) =>
      messages.push(
        JSON.parse(
          (Array.isArray(raw)
            ? Buffer.concat(raw)
            : Buffer.isBuffer(raw)
              ? raw
              : Buffer.from(raw)
          ).toString('utf8'),
        ),
      ),
    );
    return { ws, messages };
  }
  const wait = () => new Promise((r) => setTimeout(r, 30));
  try {
    const h = await client(),
      g = await client(),
      other = await client(),
      third = await client();
    g.ws.send(JSON.stringify({ type: 'join', role: 'guest', code: 'ABCD' }));
    await wait();
    assert.equal(g.messages.at(-1)?.type, 'error');
    h.ws.send(JSON.stringify({ type: 'join', role: 'host', code: 'ABCD' }));
    await wait();
    g.ws.send(JSON.stringify({ type: 'join', role: 'guest', code: 'abcd' }));
    other.ws.send(JSON.stringify({ type: 'join', role: 'host', code: 'EFGH' }));
    await wait();
    assert.equal(h.messages.at(-1)?.type, 'peer-ready');
    assert.equal(g.messages.at(-1)?.type, 'peer-ready');
    third.ws.send(
      JSON.stringify({ type: 'join', role: 'guest', code: 'ABCD' }),
    );
    await wait();
    assert.equal(third.messages.at(-1)?.type, 'error');
    const packet = {
      type: 'world',
      snapshot: new ChordProgressionEngine().snapshot(0, Date.now()),
      volume: 0.5,
      reverb: 0.3,
      manual: true,
    };
    h.ws.send(JSON.stringify(packet));
    await wait();
    assert.equal(g.messages.at(-1)?.type, 'world');
    assert.equal(
      other.messages.some((m) => m.type === 'world'),
      false,
    );
    const before = h.messages.length;
    g.ws.send(JSON.stringify(packet));
    await wait();
    assert.equal(h.messages.length, before);
    g.ws.send(JSON.stringify({ type: 'objects', objects: [] }));
    await wait();
    assert.equal(h.messages.at(-1)?.type, 'objects');
    g.ws.close();
    await wait();
    assert.equal(h.messages.at(-1)?.type, 'peer-left');
    third.ws.send(
      JSON.stringify({ type: 'join', role: 'guest', code: 'ABCD' }),
    );
    await wait();
    assert.equal(third.messages.at(-1)?.type, 'peer-ready');
    h.ws.close();
    await wait();
    assert.equal(third.messages.at(-1)?.type, 'host-left');
  } finally {
    clients.forEach((ws) => ws.terminate());
    await new Promise<void>((r) => server.close(() => r()));
  }
});
void test('a custom world supersedes a previously queued key gesture', () => {
  const h = new ChordProgressionEngine();
  h.requestKey('G');
  h.requestWorld(manualWorld(h.world, 'D', 'dorian'));
  h.advance(16);
  assert.equal(h.state().key, 'D');
});
void test('guest startup runs local selection without creating a Tone engine', async () => {
  const { PerformanceController } =
    await import('../src/app/PerformanceController');
  const oldRaf = globalThis.requestAnimationFrame,
    oldCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  const c = new PerformanceController(
    { srcObject: null } as HTMLVideoElement,
    () => {},
  );
  try {
    c.network.lan.role = 'guest';
    await c.start(true);
    assert.equal(c.running, true);
    assert.equal(c.music, undefined);
    assert.ok(c.objects().length > 0);
    c.stop();
    assert.equal(c.running, false);
  } finally {
    c.dispose();
    globalThis.requestAnimationFrame = oldRaf;
    globalThis.cancelAnimationFrame = oldCancel;
  }
});
