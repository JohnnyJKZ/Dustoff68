import { NoToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import type { Mesh, PerspectiveCamera, Scene } from 'three';
import { AdaptiveResolution } from './AdaptiveResolution';
import { PostFX } from './PostFX';

export class Renderer {
  readonly gl: WebGLRenderer;
  readonly adaptive: AdaptiveResolution;
  post: PostFX | null = null;
  showStats = false;
  fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;

  constructor(canvas: HTMLCanvasElement, quality: 'low' | 'high') {
    this.gl = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = NoToneMapping;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    this.gl.localClippingEnabled = true;
    this.gl.setClearColor(0x1a120c, 1);
    this.adaptive = new AdaptiveResolution(quality);
  }

  attach(scene: Scene, camera: PerspectiveCamera, sun: Mesh): void {
    this.post = new PostFX(this.gl, scene, camera, sun);
    this.resize();
  }

  setQuality(quality: 'low' | 'high'): void {
    this.adaptive.setQuality(quality);
    this.post?.setGodrays(quality === 'high');
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, this.adaptive.scale);
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(w, h, false);
    this.post?.setSize(w, h);
  }

  render(frameMs: number): void {
    this.fpsAcc += frameMs;
    this.fpsN++;
    if (this.fpsAcc >= 500) {
      this.fps = Math.round(1000 / (this.fpsAcc / this.fpsN));
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    if (this.adaptive.sample(frameMs)) this.resize();
    this.post?.render();
  }
}
