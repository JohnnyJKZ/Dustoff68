import { AmbientLight, Color, DirectionalLight, HemisphereLight, Vector3 } from 'three';
import type { TimePreset } from '../config';
import { shared } from '../render/uniforms';

export interface SkyPreset {
  id: TimePreset;
  sunDir: Vector3;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  ambient: number;
  fog: string;
  fogDensity: number;
  fogHeight: number;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  cloud: number;
  stars: number;
  grade: number;
}

export const presets: Record<TimePreset, SkyPreset> = {
  sunset: {
    id: 'sunset',
    sunDir: new Vector3(0.62, 0.17, -0.77).normalize(),
    sunColor: '#ff9a3a',
    sunIntensity: 4.4,
    hemiSky: '#ffb56a',
    hemiGround: '#1a2412',
    ambient: 0.28,
    fog: '#c56a32',
    fogDensity: 0.00102,
    fogHeight: 42,
    skyTop: '#24344e',
    skyHorizon: '#ffb15a',
    skyBottom: '#6a3818',
    cloud: 0.62,
    stars: 0,
    grade: 1,
  },
  dawn: {
    id: 'dawn',
    sunDir: new Vector3(-0.72, 0.14, 0.68).normalize(),
    sunColor: '#ffc2a2',
    sunIntensity: 3.1,
    hemiSky: '#f0c2b0',
    hemiGround: '#1c2618',
    ambient: 0.34,
    fog: '#d8b0a0',
    fogDensity: 0.0007,
    fogHeight: 18,
    skyTop: '#6a88a8',
    skyHorizon: '#ffd0b4',
    skyBottom: '#c48878',
    cloud: 0.4,
    stars: 0,
    grade: 0.65,
  },
  night: {
    id: 'night',
    sunDir: new Vector3(-0.4, 0.72, 0.55).normalize(),
    sunColor: '#b9c8e6',
    sunIntensity: 0.55,
    hemiSky: '#1c2840',
    hemiGround: '#0c120c',
    ambient: 0.16,
    fog: '#1a2433',
    fogDensity: 0.0013,
    fogHeight: 10,
    skyTop: '#070b14',
    skyHorizon: '#243044',
    skyBottom: '#10160f',
    cloud: 0.28,
    stars: 1,
    grade: 0,
  },
};

export function applyTime(
  id: TimePreset,
  sun: DirectionalLight,
  hemi: HemisphereLight,
  ambient: AmbientLight,
): SkyPreset {
  const p = presets[id];
  shared.uSunDir.value.copy(p.sunDir);
  shared.uSunColor.value.set(p.sunColor);
  shared.uFogColor.value.set(p.fog);
  shared.uFogDensity.value = p.fogDensity;
  shared.uFogHeight.value = p.fogHeight;
  sun.color.set(p.sunColor);
  sun.intensity = p.sunIntensity;
  hemi.color.set(p.hemiSky);
  hemi.groundColor.set(p.hemiGround);
  hemi.intensity = 0.85;
  ambient.color.set('#fff4e5');
  ambient.intensity = p.ambient;
  return p;
}

export function skyColor(preset: SkyPreset): Color {
  return new Color(preset.fog);
}
