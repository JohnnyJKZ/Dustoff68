import type { Material } from 'three';
import { shared } from './uniforms';

const VERT_PRE = /* glsl */ `
uniform float uTime;
uniform vec3 uHeliPos;
uniform float uWash;
uniform float uWashRadius;
varying vec3 vHFogWorld;
varying float vSlopeY;
`;

const FRAG_PRE = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogHeight;
uniform float uFogFalloff;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCamPos;
uniform float uWet;
uniform float uFlash;
varying vec3 vHFogWorld;
varying float vSlopeY;
`;

const FOG = /* glsl */ `
  float hFogH = max(vHFogWorld.y - uFogHeight, 0.0);
  float hFogD = distance(vHFogWorld, uCamPos);
  float hFogDens = uFogDensity * exp(-hFogH * uFogFalloff);
  float hFog = 1.0 - exp(-max(hFogD - 90.0, 0.0) * hFogDens);
  vec3 hView = normalize(vHFogWorld - uCamPos);
  float hSun = pow(max(dot(hView, normalize(uSunDir)), 0.0), 8.0);
  vec3 hFogCol = mix(uFogColor, uSunColor, hSun * 0.55);
  hFogCol += uSunColor * uFlash * 0.35;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hFogCol, clamp(hFog, 0.0, 0.62));
`;

function assign(shader: { uniforms: Record<string, { value: unknown }> }): void {
  const bag = shader.uniforms;
  bag.uTime = shared.uTime;
  bag.uHeliPos = shared.uHeliPos;
  bag.uWash = shared.uWash;
  bag.uWashRadius = shared.uWashRadius;
  bag.uWet = shared.uWet;
  bag.uFogColor = shared.uFogColor;
  bag.uFogDensity = shared.uFogDensity;
  bag.uFogHeight = shared.uFogHeight;
  bag.uFogFalloff = shared.uFogFalloff;
  bag.uSunDir = shared.uSunDir;
  bag.uSunColor = shared.uSunColor;
  bag.uCamPos = shared.uCamPos;
  bag.uFlash = shared.uFlash;
}

export function styleMaterial(material: Material, kind: 'terrain' | 'foliage' | 'lit'): void {
  const token = kind;
  material.customProgramCacheKey = () => `dustoff-${token}`;
  material.onBeforeCompile = (shader) => {
    assign(shader);
    shader.vertexShader = VERT_PRE + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec4 hLocal = vec4(transformed, 1.0);
      vec3 hNormal = normal;
      #ifdef USE_INSTANCING
        hLocal = instanceMatrix * hLocal;
        hNormal = mat3(instanceMatrix) * hNormal;
      #endif
      vec4 hWorld = modelMatrix * hLocal;
      vSlopeY = normalize(mat3(modelMatrix) * hNormal).y;
      ${
        kind === 'foliage'
          ? `
      float sway = sin(uTime * 1.45 + hWorld.x * 0.08 + hWorld.z * 0.05) * transformed.y * 0.04;
      hWorld.x += sway;
      hWorld.z += cos(uTime * 1.1 + hWorld.z * 0.06) * transformed.y * 0.02;
      vec2 away = hWorld.xz - uHeliPos.xz;
      float distW = length(away);
      float inf = (1.0 - smoothstep(2.0, uWashRadius, distW)) * uWash;
      vec2 dir = distW > 0.001 ? away / distW : vec2(1.0, 0.0);
      hWorld.xz += dir * inf * transformed.y * 1.35;
      hWorld.y -= inf * transformed.y * 0.42;
      `
          : ''
      }
      vHFogWorld = hWorld.xyz;
      vec4 mvPosition = viewMatrix * hWorld;
      gl_Position = projectionMatrix * mvPosition;
      `,
    );
    shader.fragmentShader = FRAG_PRE + shader.fragmentShader;
    if (kind === 'terrain') {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float hPatch = fract(sin(dot(vHFogWorld.xz, vec2(0.37, 0.19))) * 43758.5453);
        diffuseColor.rgb *= mix(0.96, 1.06, hPatch);
        float pathN = sin(vHFogWorld.x * 0.007 + sin(vHFogWorld.z * 0.005) * 2.4);
        float path = smoothstep(0.93, 0.99, pathN) * smoothstep(0.8, 0.98, vSlopeY);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.28, 0.13), path * 0.7);
        float rock = 1.0 - smoothstep(0.28, 0.72, vSlopeY);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.4, 0.34), rock * 0.85);
        float ao = smoothstep(0.35, 0.95, vSlopeY);
        diffuseColor.rgb *= mix(0.82, 1.0, ao);
        diffuseColor.rgb *= mix(1.0, 0.75, uWet);
        `,
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', FOG);
  };
}
