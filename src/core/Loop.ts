import { config } from '../config';

export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    const step = 1 / config.sim.hz;
    const frame = (t: number) => {
      this.raf = requestAnimationFrame(frame);
      if (!this.last) this.last = t;
      let frameDt = (t - this.last) / 1000;
      this.last = t;
      if (frameDt > config.sim.maxFrame) frameDt = config.sim.maxFrame;
      if (frameDt < 0) frameDt = 0;
      this.acc += frameDt;
      let n = 0;
      while (this.acc >= step && n < config.sim.maxSteps) {
        this.update(step);
        this.acc -= step;
        n++;
      }
      if (n === config.sim.maxSteps) this.acc = 0;
      this.render(this.acc / step, frameDt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
