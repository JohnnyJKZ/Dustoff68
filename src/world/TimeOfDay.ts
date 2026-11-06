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
    sunDir: new Vector3(0.55, 0.1, -0.83).normalize(),
    sunColor: '#ffb04a',
    sunIntensity: 6.2,
    hemiSky: '#8eb0d4',
    hemiGround: '#1a3a18',
    ambient: 0.22,
    fog: '#e7c48a',
    fogDensity: 0.00022,
    fogHeight: 12,
    skyTop: '#16345c',
    skyHorizon: '#ffb03a',
    skyBottom: '#c46a28',
    cloud: 0.85,
    stars: 0,
    grade: 1,
  },
  dawn: {
    id: 'dawn',
    sunDir: new Vector3(-0.62, 0.12, 0.78).normalize(),
    sunColor: '#ffc27a',
    sunIntensity: 4.6,
    hemiSky: '#9eb8d0',
    hemiGround: '#1c3a1c',
    ambient: 0.26,
    fog: '#d8c4a4',
    fogDensity: 0.00026,
    fogHeight: 10,
    skyTop: '#3d6a90',
    skyHorizon: '#ffc48a',
    skyBottom: '#c48858',
    cloud: 0.72,
    stars: 0,
    grade: 0.35,
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
  shared.uFogFalloff.value = id === 'night' ? 0.03 : 0.055;
  sun.color.set(p.sunColor);
  sun.intensity = p.sunIntensity;
  hemi.color.set(p.hemiSky);
  hemi.groundColor.set(p.hemiGround);
  hemi.intensity = id === 'night' ? 0.35 : 1.05;
  ambient.color.set('#fff4e5');
  ambient.intensity = p.ambient;
  return p;
}

export function skyColor(preset: SkyPreset): Color {
  return new Color(preset.fog);
}
