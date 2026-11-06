/**
 * Every gameplay and look-dev constant lives here.
 * Player preferences (volume, assist, quality) live in save.ts.
 */
export const config = {
  sim: { hz: 120, maxSteps: 6, maxFrame: 0.05 },

  world: {
    mapSize: 4096,
    playRadius: 1850,
    chunkCount: 16,
    lodSegs: [64, 32, 16] as const,
    lodDistances: [420, 900] as const,
  },

  flight: {
    emptyMass: 2360,
    paxKg: 90,
    maxThrust: 43000,
    collectiveRate: 0.42,
    maxPitch: 0.38,
    maxRoll: 0.42,
    maxYawRate: 0.85,
    ratePitch: 0.7,
    rateRoll: 0.85,
    attitudeStiffness: 9.5,
    attitudeDamping: 6.2,
    autoBank: 0.34,
    velDamp: 0.012,
    drag: 2.7,
    rotorRadius: 7.3,
    rotorHeight: 1.85,
    skidDrop: 1.45,
    groundEffect: 0.32,
    etlAmount: 0.1,
    etlSpeed: 8,
    settleSpeed: 0.85,
    spool: 0.7,
    engineOutSpool: 0.18,
    borderPush: 50,
    skids: [
      [-1.05, -1.45, 1.15],
      [1.05, -1.45, 1.15],
      [-1.05, -1.45, -0.85],
      [1.05, -1.45, -0.85],
    ] as const,
  },

  fuel: {
    capacityKg: 520,
    burnIdle: 0.00135,
    burnCollective: 0.00255,
    refuelRate: 0.22,
    warn: 0.2,
    critical: 0.1,
  },

  damage: {
    hardLandingVy: 2.6,
    hardK: 2.4,
    slideSpeed: 7,
    slideK: 1.6,
    maxSlope: 0.22,
    slopeDps: 6,
    trunkHit: 14,
    rotorStrike: 11,
    treeCooldown: 0.55,
    waterHit: 22,
    fatal: 100,
  },

  hoist: {
    maxLength: 22,
    segments: 16,
    radius: 9,
    maxSpeed: 3.2,
    minAgl: 7,
    maxAgl: 26,
    seconds: 4.2,
    retractSpeed: 0.45,
  },

  passengers: {
    capacity: 3,
    boardSeconds: 1.55,
    unloadSeconds: 1.15,
    walkSpeed: 3.2,
  },

  golden: { urgent: 180, priority: 300, routine: 420 },

  threats: {
    groundHit: 4.5,
    groundRate: 0.42,
    aaHit: 8,
    aaRate: 0.28,
    aaRange: 780,
    aaMinAgl: 32,
    alertTime: 1.6,
  },

  graphics: {
    treeCap: 8200,
    grassCap: 2800,
    riceCap: 2200,
    treeCell: 128,
    grassRadius: 210,
    treeRadius: 1050,
    fullDist: 170,
    midDist: 420,
    pixelMin: 0.6,
    pixelMax: 1.15,
    targetFrameMs: 16.9,
    washRadius: 26,
  },

  audio: { crossfade: 2.4, musicDuck: 0.55 },

  camera: {
    chaseDist: 15.5,
    chaseHeight: 5.2,
    chaseLook: 1.6,
    chaseLambda: 3.4,
    cockpit: [0.28, 0.38, 1.15] as const,
  },

  demo: { idleSeconds: 20, restartHold: 3.2 },
} as const;

export type AssistLevel = 0 | 1 | 2;
export type TimePreset = 'dawn' | 'sunset' | 'night';
export type Triage = 'urgent' | 'priority' | 'routine';
export type MedalId = 'none' | 'air' | 'dfc' | 'ss';
