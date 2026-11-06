import { Color, Vector3 } from 'three';

export const shared = {
  uTime: { value: 0 },
  uHeliPos: { value: new Vector3() },
  uWash: { value: 0 },
  uWashRadius: { value: 26 },
  uWet: { value: 0 },
  uFogColor: { value: new Color('#e7c48a') },
  uFogDensity: { value: 0.00022 },
  uFogHeight: { value: 12 },
  uFogFalloff: { value: 0.055 },
  uSunDir: { value: new Vector3(0.45, 0.18, -0.87).normalize() },
  uSunColor: { value: new Color('#ffb15a') },
  uCamPos: { value: new Vector3() },
  uFlash: { value: 0 },
};
