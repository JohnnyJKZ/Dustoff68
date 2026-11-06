export type GameState =
  'title' | 'briefing' | 'playing' | 'paused' | 'complete' | 'failed' | 'demo';

export interface EventMap {
  stateChange: { from: GameState; to: GameState };
  radio: { text: string };
  damage: { amount: number; total: number; source: string };
  missionEnd: { outcome: 'complete' | 'failed'; reason: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus<M extends object> {
  private map = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    let set = this.map.get(type);
    if (!set) {
      set = new Set();
      this.map.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of set) fn(payload as never);
  }
}

export const bus = new EventBus<EventMap>();
