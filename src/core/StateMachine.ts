import { bus, type GameState } from './events';

export class StateMachine {
  state: GameState = 'title';

  set(next: GameState): void {
    if (next === this.state) return;
    const from = this.state;
    this.state = next;
    bus.emit('stateChange', { from, to: next });
  }
}
