// Deterministic election: explicit global role, then auto, then object role.
export class WorldAuthority {
  private peers = new Map<string, { priority: number; seenAt: number }>();
  constructor(
    readonly self: string,
    private priority: () => number,
  ) {}
  observe(id: string, priority: number, now: number) {
    this.peers.set(id, { priority, seenAt: now });
  }
  leader(now: number) {
    for (const [id, p] of this.peers)
      if (now - p.seenAt > 5000) this.peers.delete(id);
    return [
      { id: this.self, priority: this.priority() },
      ...Array.from(this.peers, ([id, p]) => ({ id, priority: p.priority })),
    ].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0].id;
  }
  clear() {
    this.peers.clear();
  }
}
