export class Input {
  readonly down = new Set<string>();
  private edges = new Set<string>();

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const block = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (block.includes(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.edges.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.edges.clear();
    });
  }

  consume(code: string): boolean {
    if (!this.edges.has(code)) return false;
    this.edges.delete(code);
    return true;
  }

  held(code: string): boolean {
    return this.down.has(code);
  }

  endFrame(): void {
    this.edges.clear();
  }

  axis(neg: string, pos: string): number {
    return (this.held(pos) ? 1 : 0) - (this.held(neg) ? 1 : 0);
  }
}
