export class Radio {
  line = '';
  private timer = 0;

  say(text: string, seconds = 5.2): void {
    this.line = text;
    this.timer = seconds;
  }

  update(dt: number): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.line = '';
  }

  get active(): boolean {
    return this.timer > 0;
  }
}
