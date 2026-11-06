import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  KernelSize,
  LookupTexture,
  LUT3DEffect,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, Mesh, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { clamp, smoothstep } from '../util/math';

export class PostFX {
  readonly composer: EffectComposer;
  godrays: GodRaysEffect | null = null;
  private readonly grade: LUT3DEffect;
  private readonly warmLut: LookupTexture;
  private readonly coolLut: LookupTexture;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, sun: Mesh) {
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    this.warmLut = makeLut(1);
    this.coolLut = makeLut(0.15);
    this.grade = new LUT3DEffect(this.warmLut, { blendFunction: BlendFunction.SET });

    const bloom = new BloomEffect({
      intensity: 0.55,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.18,
      mipmapBlur: true,
      radius: 0.55,
    });
    const smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM });
    const vignette = new VignetteEffect({ darkness: 0.52, offset: 0.28 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    noise.blendMode.opacity.value = 0.18;
    const chroma = new ChromaticAberrationEffect({
      offset: new Vector2(0.0004, 0.0004),
      radialModulation: true,
      modulationOffset: 0.4,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });

    try {
      this.godrays = new GodRaysEffect(camera, sun, {
        blendFunction: BlendFunction.SCREEN,
        samples: 40,
        density: 0.94,
        decay: 0.95,
        weight: 0.28,
        exposure: 0.32,
        clampMax: 0.9,
        resolutionScale: 0.5,
        kernelSize: KernelSize.SMALL,
        blur: true,
      });
    } catch (err) {
      console.warn('godrays disabled', err);
      this.godrays = null;
    }

    this.composer.addPass(new EffectPass(camera, bloom));
    if (this.godrays) this.composer.addPass(new EffectPass(camera, this.godrays));
    this.composer.addPass(new EffectPass(camera, tone, this.grade, vignette, noise));
    this.composer.addPass(new EffectPass(camera, chroma));
    this.composer.addPass(new EffectPass(camera, smaa));
  }

  setWarmth(warm: number): void {
    this.grade.lut = warm > 0.5 ? this.warmLut : this.coolLut;
  }

  setGodrays(on: boolean): void {
    if (this.godrays) this.godrays.blendMode.opacity.value = on ? 1 : 0;
  }

  render(): void {
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }
}

function makeLut(warm: number): LookupTexture {
  const size = 16;
  const data = new Float32Array(size ** 3 * 4);
  const sizeSq = size * size;
  const s = 1 / (size - 1);
  for (let r = 0; r < size; r++) {
    for (let g = 0; g < size; g++) {
      for (let b = 0; b < size; b++) {
        let R = r * s;
        let G = g * s;
        let B = b * s;
        R = (R - 0.5) * 1.1 + 0.5;
        G = (G - 0.5) * 1.06 + 0.5;
        B = (B - 0.5) * (1.02 - warm * 0.06) + 0.5;
        const l = R * 0.3 + G * 0.55 + B * 0.15;
        const sh = 1 - smoothstep(0, 0.5, l);
        B += sh * 0.045 * (1 - warm * 0.4);
        G += sh * 0.015;
        R += (1 - sh) * 0.055 * warm;
        R += 0.02 * warm;
        const i4 = (r + g * size + b * sizeSq) * 4;
        data[i4] = clamp(R, 0, 1);
        data[i4 + 1] = clamp(G, 0, 1);
        data[i4 + 2] = clamp(B, 0, 1);
        data[i4 + 3] = 1;
      }
    }
  }
  return new LookupTexture(data, size);
}
