import * as THREE from 'three';

/* Floor recipe. Each row of FLOOR_SPECS is one level of the tower; adding a
   floor is one row. `room: null` builds the slab, rail and planters only.
     room      key into ROOMS (furniture) and the traced shader's room type
     seed      varies plank layout and wall noise between floors
     state     LIGHT_STATES key (bright / dim / glow / dark); `light` overrides with a number
     furnish   real furniture + a real PointLight (Level 01 only)
     theme     THEMES key: a furnished, merged set lit by emissive only; `name` labels the lift stop
     wall      feature-wall finish colour (linear RGB)
     curtains  CURTAINS preset name, or [length, x, z, rotY] panels
     terrace   { shoe, set, at } balustrade shoe; set = TERRACE_SETS key (lounge / dining /
               daybed / fire), auto-placed on the door side unless `at: [x, z]`
     tree      a small multi-stem tree in a terrace corner (every third floor)
     trail     [from, to] fraction of the slab edge (0 = front centre-left, running +x) where planting spills over
     planting  planter-ring seed
     glass     placeholder curtain wall with a dark interior (no room)
     door      −1 / +1: sliding door on the −x / +x glass run
     dims      optional { w, d } slab override (Level 01 is deeper)
     note      key for anchors / glowPts labels */
export const FLOOR_SPECS = [
  {
    i: 0,
    room: 'living',
    seed: 0,
    light: 1,
    wall: [0.16, 0.09, 0.05],
    dims: { w: 18, d: 15.3 },
    curtains: [
      [1.3, -6.05, 1.0, Math.PI / 2],
      [1.8, 2.2, 4.45, 0],
      [2.2, 6.05, -0.6, -Math.PI / 2],
    ],
    terrace: { shoe: true, set: 'lounge', at: [-7.2, -0.8] },
    planting: 0,
    door: -1,
    note: 'level',
    furnish: true,
  },
  // Floors 02–10: a themed residence each (THEMES), no real lights; neighbours never match.
  {
    i: 1,
    theme: 'suite',
    name: 'Primary suite',
    room: 'bedroom',
    seed: 1,
    state: 'glow',
    wall: [0.42, 0.36, 0.3],
    terrace: { shoe: true, set: 'daybed' },
    planting: 1,
    trail: [0.02, 0.24],
  },
  {
    i: 2,
    theme: 'library',
    name: 'Library',
    room: 'study',
    seed: 2,
    state: 'bright',
    wall: [0.12, 0.07, 0.04],
    curtains: 'open',
    terrace: { shoe: true, set: 'dining' },
    planting: 2,
    tree: true,
    door: 1,
  },
  {
    i: 3,
    theme: 'den',
    name: 'Media den',
    room: 'family',
    seed: 3,
    state: 'dark',
    wall: [0.2, 0.2, 0.21],
    terrace: { shoe: true, set: 'fire' },
    planting: 3,
  },
  {
    i: 4,
    theme: 'salon',
    name: "Collector's salon",
    room: 'living',
    seed: 4,
    state: 'dim',
    wall: [0.3, 0.27, 0.22],
    curtains: 'half',
    terrace: { shoe: true, set: 'lounge' },
    planting: 4,
    trail: [0.12, 0.36],
    door: -1,
  },
  {
    i: 5,
    theme: 'guest',
    name: 'Guest suite',
    room: 'guest',
    seed: 5,
    state: 'glow',
    wall: [0.24, 0.15, 0.1],
    terrace: { shoe: true },
    planting: 5,
    tree: true,
  },
  {
    i: 6,
    theme: 'gym',
    name: 'Wellness studio',
    room: 'gym',
    seed: 6,
    state: 'bright',
    wall: [0.08, 0.08, 0.085],
    curtains: 'open',
    terrace: { shoe: true, set: 'dining' },
    planting: 6,
    door: 1,
  },
  {
    i: 7,
    theme: 'kids',
    name: "Children's room",
    room: 'bedroom',
    seed: 7,
    state: 'dark',
    wall: [0.36, 0.3, 0.26],
    terrace: { shoe: true, set: 'daybed' },
    planting: 7,
    trail: [0.0, 0.18],
  },
  {
    i: 8,
    theme: 'atelier',
    name: "Architect's atelier",
    room: 'study',
    seed: 8,
    state: 'dim',
    wall: [0.18, 0.11, 0.06],
    curtains: 'half',
    terrace: { shoe: true, set: 'fire' },
    planting: 8,
    tree: true,
    door: -1,
  },
  {
    i: 9,
    theme: 'host',
    name: 'Entertaining',
    room: 'family',
    seed: 9,
    state: 'bright',
    wall: [0.14, 0.1, 0.07],
    curtains: 'open',
    terrace: { shoe: true, set: 'lounge' },
    planting: 9,
  },
];
// Study shares the lounge's library wall; each other type has its own back wall and traced prop.
const ROOM_TYPES = { living: 0, lounge: 1, study: 1, bedroom: 2, family: 3, gym: 4, guest: 5 };
// Light states for any room: traced-room brightness. 'glow' also closes the sheers and lights them.
export const LIGHT_STATES = { bright: 1.2, dim: 0.55, glow: 0.45, dark: 0.04 };
// Sheers on the straight glass runs : half drawn, or closed and glowing.
export const CURTAINS = {
  open: [],
  half: [
    [1.3, -6.05, 1.0, Math.PI / 2],
    [1.8, 2.2, 4.45, 0],
    [2.2, 6.05, -0.6, -Math.PI / 2],
  ],
  closed: [
    [3.4, -6.05, 0, Math.PI / 2],
    [6.6, 0, 4.45, 0],
    [3.4, 6.05, 0, -Math.PI / 2],
  ],
};
export const FLOORS = {}; // i → { g, w, d, r }, filled top-down so a floor can read the one above

/* People. A few floors have someone at home: each walks a lane in the room,
   pauses, and walks back. [x0, x1, z] in the floor's frame, a pause range in
   seconds and a seed. Positions are worked out once per frame in JS
   (peopleStep) and handed to the traced room, which draws the person, and to
   that floor's sheers, which take their shadow. Nobody walks into the glass:
   the lanes stay in the clear band in front of the furniture. */
export const PEOPLE = {
  0: [{ lane: [-4.2, 1.2, 3.85], pause: [3, 6], seed: 1 }],
  1: [{ lane: [-3.0, 2.6, 3.65], pause: [4, 8], seed: 2 }],
  2: [{ lane: [-2.4, 0.9, -3.5], pause: [6, 10], seed: 3 }],
  4: [
    { lane: [-1.5, -0.9, 3.4], pause: [9, 13], seed: 4 },
    { lane: [0.0, 0.5, 3.3], pause: [7, 11], seed: 5 },
  ],
  5: [{ lane: [-2.2, 2.4, 3.7], pause: [5, 9], seed: 6 }],
  8: [{ lane: [-0.3, 1.5, -1.9], pause: [8, 13], seed: 8 }],
  9: [
    { lane: [-3.6, 1.4, 3.6], pause: [3, 6], seed: 9 },
    { lane: [1.2, 2.3, 3.2], pause: [8, 12], seed: 10 },
  ],
};
export const FIG_FLOORS = []; // { i, g, people, figU, invU } once built
// Ray–capsule (Inigo Quilez) and segment–segment distance, shared by the room and the sheers.
export const FIG_GLSL = /* glsl */ `
  float capT(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
    vec3 ba = pb - pa, oa = ro - pa;
    float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
    float a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - r * r * baba;
    float h = b * b - a * c;
    if (h >= 0.0) {
      float t = (-b - sqrt(h)) / a, y = baoa + t * bard;
      if (y > 0.0 && y < baba) return t;
      vec3 oc = y <= 0.0 ? oa : ro - pb;
      b = dot(rd, oc); c = dot(oc, oc) - r * r; h = b * b - c;
      if (h > 0.0) return -b - sqrt(h);
    }
    return -1.0;
  }
  // Closest distance between segments p1–q1 and p2–q2; .y is where along p1–q1 (0–1).
  vec2 segSeg(vec3 p1, vec3 q1, vec3 p2, vec3 q2) {
    vec3 d1 = q1 - p1, d2 = q2 - p2, r = p1 - p2;
    float a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
    float s = den > 1e-6 ? clamp((b * f - c * e) / den, 0.0, 1.0) : 0.0;
    float t = (b * s + f) / e;
    if (t < 0.0) { t = 0.0; s = clamp(-c / a, 0.0, 1.0); } else if (t > 1.0) { t = 1.0; s = clamp((b - c) / a, 0.0, 1.0); }
    return vec2(length(p1 + d1 * s - p2 - d2 * t), s);
  }`;

// The traced apartment, shared by every floor: one program, per-floor uniforms.
const ROOM_VERT = /* glsl */ `
  varying vec3 vL; varying vec3 vCam;
  void main() {
    vL = position;
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const ROOM_FRAG = /* glsl */ `
  uniform vec3 uMin, uMax, uLamp, uWall, uPropMin, uPropMax, uProp; uniform float uType, uSeed, uLight;
  uniform vec4 uFig[2];
  uniform mat4 projectionMatrix; uniform mat4 modelMatrix;
  varying vec3 vL; varying vec3 vCam;
  ${FIG_GLSL}
  // Nearest hit on a person: legs, a torso as two capsules (broad from the
  // front, slim side-on), swinging arms and a head. Silhouette first: seen
  // through glass at terrace distance, the outline is what reads as a person.
  float figT(vec3 ro, vec3 rd, vec4 f) {
    if (f.w <= 0.0) return -1.0;
    float h = f.w, t = 1e9, k; vec3 b = vec3(f.x, uMin.y, f.y);
    for (int i = 0; i < 2; i++) {
      float sd = i == 0 ? 1.0 : -1.0, a = f.z * sd;
      vec3 hip = b + vec3(0.0, 0.9 * h, sd * 0.09);
      k = capT(ro, rd, hip, hip + vec3(sin(a), -cos(a), 0.0) * 0.86 * h, 0.07); if (k > 0.0) t = min(t, k);
      vec3 sh = b + vec3(0.0, 1.36 * h, sd * 0.2);
      k = capT(ro, rd, sh, b + vec3(-sin(a) * 0.45 * h, 0.8 * h, sd * 0.24), 0.045); if (k > 0.0) t = min(t, k);
      k = capT(ro, rd, b + vec3(0.0, 0.98 * h, sd * 0.07), b + vec3(0.0, 1.36 * h, sd * 0.07), 0.13); if (k > 0.0) t = min(t, k);
    }
    k = capT(ro, rd, b + vec3(0.0, 1.6 * h, 0.0), b + vec3(0.0, 1.62 * h, 0.0), 0.1 * h); if (k > 0.0) t = min(t, k);
    return t < 1e8 ? t : -1.0;
  }
  const vec3 WARM = vec3(1.0, 0.76, 0.5), COOL = vec3(0.35, 0.55, 1.0);
  // Self-lit parts (a TV screen) add here, so they stay on when the room light is off.
  vec3 gEmit = vec3(0.0);
  bool isType(float k) { return abs(uType - k) < 0.5; }
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n21(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float lampAt(vec3 p) { float d = distance(p, uLamp); return 2.6 / (1.0 + d * d * 0.6); }
  vec3 ceilingAt(vec2 q, float blur) {
    q = clamp(q, uMin.xz, uMax.xz);
    vec3 plaster = vec3(0.55, 0.52, 0.48);
    vec2 c = (fract(q / 1.5 + 0.5) - 0.5) * 1.5;
    float dl = exp(-dot(c, c) / (0.002 + blur)) * mix(12.0, 1.0, clamp(blur * 10.0, 0.0, 1.0));
    if (isType(4.0)) dl = exp(-c.x * c.x / (0.0015 + blur)) * mix(5.0, 1.0, clamp(blur * 10.0, 0.0, 1.0)) * step(abs(q.y), 3.6);
    float dw = min(min(q.x - uMin.x, uMax.x - q.x), min(q.y - uMin.z, uMax.z - q.y));
    float slot = (1.0 - smoothstep(0.35, 0.42, dw)) * smoothstep(0.25, 0.32, dw);
    float cove = exp(-max(dw, 0.0) * 2.2);
    return plaster * (0.12 + 0.6 * cove) + WARM * (dl + slot * 2.2);
  }
  vec3 floorAt(vec3 p, vec3 rd) {
    vec2 q = p.xz;
    float row = floor(q.y / 0.22), off = h21(vec2(row, 3.0 + uSeed)) * 2.0;
    float plank = fract((q.x + off) / 2.0), seam = fract(q.y / 0.22);
    float gap = max(1.0 - smoothstep(0.0, 0.02, min(seam, 1.0 - seam)), 1.0 - smoothstep(0.0, 0.004, min(plank, 1.0 - plank) * 2.0));
    vec3 oak = vec3(0.36, 0.22, 0.12) * (0.8 + 0.3 * h21(vec2(row, floor((q.x + off) / 2.0))));
    oak *= 0.85 + 0.25 * n21(vec2(q.x * 3.0, q.y * 40.0));
    oak *= 1.0 - 0.5 * gap;
    // Gym: speckled rubber, no planks.
    if (isType(4.0)) { oak = vec3(0.12, 0.12, 0.125) * (0.8 + 0.4 * h21(floor(q * 60.0))); gap = 0.0; }
    // Family: the screen's cool spill across the floor in front of it.
    if (isType(3.0)) gEmit += COOL * 0.12 * exp(-(q.y - uMin.z) * 0.7) * exp(-q.x * q.x * 0.15);
    vec2 c = (fract(q / 1.5 + 0.5) - 0.5) * 1.5;
    vec3 lit = oak * (0.18 + WARM * (exp(-dot(c, c) / 0.6) * 0.7 + lampAt(p)));
    vec3 r = vec3(rd.x, -rd.y, rd.z);
    float tt = (uMax.y - p.y) / max(r.y, 1e-3);
    vec3 refl = ceilingAt(q + r.xz * tt, 0.03 + tt * 0.004);
    float fr = 0.03 + 0.25 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 4.0);
    return lit + refl * fr * (1.0 - gap);
  }
  // Back walls for the room library (types 2–5); the slatted finish panel is the base.
  vec3 typeWall(vec2 uv, vec3 p, float y, float top, vec3 col) {
    if (isType(2.0) || isType(5.0)) {
      // Bedroom / guest: upholstered headboard, a hidden strip washing up from it, bedside lamps.
      float hw = isType(5.0) ? 1.5 : 2.2;
      if (abs(uv.x) < hw && y < 1.25) {
        float tuft = 0.85 + 0.15 * smoothstep(0.0, 0.04, abs(fract(uv.x / 0.55) - 0.5) - 0.42);
        col = (uWall * 0.6 + 0.25) * tuft * (0.3 + WARM * lampAt(p) * 0.7);
      } else if (abs(uv.x) < hw + 0.3 && y > 1.25) col += WARM * 0.9 * exp(-(y - 1.25) * 2.2);
      for (int k = 0; k < 2; k++) {
        if (isType(5.0) && k == 1) break;
        float lx = (k == 0 ? 1.0 : -1.0) * (hw + 0.55);
        vec2 d = vec2(uv.x - lx, y - 0.8);
        col += WARM * 0.7 * exp(-dot(d, d) * 2.5);
        if (length(d * vec2(1.0, 1.5)) < 0.17) col = vec3(1.7, 1.2, 0.75);
      }
    } else if (isType(3.0)) {
      // Family: a big screen on a low console, its cool glow on the wall around it.
      vec2 d = vec2(uv.x / 1.4, (y - 1.5) / 0.8);
      col *= 0.6;
      if (abs(uv.x) < 2.6 && y < 0.45) col = vec3(0.03, 0.025, 0.02) + WARM * 0.05;
      gEmit += COOL * 0.18 * exp(-dot(d, d) * 0.6);
      if (abs(uv.x) < 1.25 && abs(y - 1.5) < 0.7) {
        col = vec3(0.0);
        if (abs(uv.x) < 1.2 && abs(y - 1.5) < 0.66) gEmit = COOL * (0.55 + 0.35 * n21(uv * vec2(2.0, 3.0) + uSeed)) + vec3(0.1, 0.05, 0.0) * n21(uv * 5.0);
      }
    } else if (isType(4.0)) {
      // Gym: a full mirror wall in 1.2 m panels, catching the linear ceiling lights.
      float seam = 1.0 - smoothstep(0.0, 0.01, abs(fract(uv.x / 1.2) - 0.5) * 1.2 - 0.59);
      float strip = exp(-pow((fract(uv.x / 1.5 + 0.5) - 0.5) * 1.5 / 0.06, 2.0)) * smoothstep(top - 1.6, top, y);
      col = vec3(0.06, 0.062, 0.066) + WARM * (strip * 1.6 + 0.16 * exp(-(top - y) * 0.8));
      col *= 1.0 - 0.6 * seam;
    }
    return col;
  }
  vec3 featureWall(vec2 uv, vec3 p) {
    float y = uv.y - uMin.y, top = uMax.y - uMin.y;
    vec3 plaster = vec3(0.6, 0.57, 0.52) * (0.92 + 0.08 * n21(uv * 2.0 + uSeed));
    float wash = 0.12 + 1.1 * exp(-(top - y) * 1.3);
    vec3 col = plaster * (wash + WARM * lampAt(p) * 0.6);
    if (abs(uv.x) < 3.0) {
      float slat = 0.75 + 0.25 * smoothstep(0.0, 0.01, abs(fract(uv.x / 0.09) - 0.5) - 0.42);
      vec3 finish = uWall * slat * (0.8 + 0.4 * n21(vec2(uv.x * 30.0, uv.y * 2.0)));
      col = finish * (wash * 1.4 + WARM * lampAt(p) * 0.6);
      if (uType > 1.5) {
        // Plain: one finish panel, washed from the cove (a placeholder finish).
      } else if (uType > 0.5) {
        // Lounge: full-height library wall, warm-lit niches on a 0.9 × 0.6 m grid.
        vec2 c = vec2(fract(uv.x / 0.9), fract(y / 0.6));
        if (y > 0.5 && min(min(c.x, 1.0 - c.x), min(c.y, 1.0 - c.y)) > 0.06)
          col = vec3(0.05, 0.035, 0.02) + WARM * (0.25 + 0.6 * smoothstep(0.6, 1.0, c.y)) * (0.5 + 0.5 * h21(floor(vec2(uv.x / 0.9, y / 0.6)) + uSeed));
      } else {
        // Living: a linear fireplace, dark firebox with a low, flicker-free flame band.
        if (abs(uv.x) < 1.6 && y > 0.32 && y < 0.78) {
          float flame = smoothstep(0.42, 0.5, y) * (1.0 - smoothstep(0.5, 0.72, y)) * (0.6 + 0.4 * n21(vec2(uv.x * 9.0, 2.0)));
          col = vec3(0.01) + vec3(2.4, 1.0, 0.32) * flame;
        }
        // Framed print above the fire, picked out by a picture light.
        if (abs(uv.x) < 1.1 && y > 1.15 && y < 2.15) {
          bool inner = abs(uv.x) < 1.0 && y > 1.24 && y < 2.06;
          float pl = 0.5 + 1.4 * exp(-(2.15 - y) * 2.5);
          vec3 art = mix(vec3(0.75, 0.72, 0.66), vec3(0.1, 0.09, 0.08), smoothstep(0.48, 0.52, n21(uv * vec2(1.4, 3.0)) + (y - 1.6) * 0.3));
          col = (inner ? art : vec3(0.06, 0.045, 0.03)) * pl;
        }
      }
    }
    if (uType > 1.5) col = typeWall(uv, p, y, top, col);
    // Shadow-gap skirting.
    col *= 1.0 - 0.75 * (1.0 - smoothstep(0.06, 0.075, y));
    return col;
  }
  vec3 farGlass(float u, float y) {
    vec3 night = mix(vec3(0.02, 0.022, 0.04), vec3(0.006, 0.008, 0.018), smoothstep(uMin.y, uMax.y, y));
    float m = 1.0 - smoothstep(0.02, 0.045, abs((fract(u / 1.5 + 0.5) - 0.5) * 1.5));
    return night * (1.0 - 0.85 * m) + WARM * 0.05 * exp(-pow(y - uMin.y - 2.0, 2.0));
  }
  void main() {
    vec3 ro = vL, rd = normalize(vL - vCam);
    vec3 tA = (uMin - ro) / rd, tB = (uMax - ro) / rd, tF = max(tA, tB);
    float t = max(min(min(tF.x, tF.y), tF.z), 0.0);
    vec3 p = ro + rd * t, col;
    vec3 ds = vec3(min(p.x - uMin.x, uMax.x - p.x), min(p.y - uMin.y, uMax.y - p.y), min(p.z - uMin.z, uMax.z - p.z));
    if (tF.y <= tF.x && tF.y <= tF.z) { col = rd.y < 0.0 ? floorAt(p, rd) : ceilingAt(p.xz, 0.0); ds.y = 99.0; }
    else if (tF.x <= tF.z) { col = farGlass(p.z, p.y); ds.x = 99.0; }
    else { col = rd.z < 0.0 ? featureWall(p.xy, p) : farGlass(p.x, p.y); ds.z = 99.0; }
    // One traced prop (bed, sofa, desk, bench) on floors without real furniture.
    if (uPropMax.x > uPropMin.x) {
      vec3 pA = (uPropMin - ro) / rd, pB = (uPropMax - ro) / rd, pn = min(pA, pB), pf = max(pA, pB);
      float t0 = max(max(pn.x, pn.y), pn.z), t1 = min(min(pf.x, pf.y), pf.z);
      if (t0 < t1 && t0 > 0.0 && t0 < t) {
        p = ro + rd * t0;
        float lid = pn.y >= t0 - 1e-4 ? 1.0 : 0.0;
        col = uProp * (0.25 + 0.75 * lid) * (0.3 + WARM * (lampAt(p) * 0.6 + 0.35)) * (0.6 + 0.4 * smoothstep(0.0, 0.2, p.y - uMin.y));
        ds = vec3(99.0);
      }
    }
    // The people who live here (PEOPLE): mostly dark against the lit room,
    // picked out by the lamp; clothing tone varies by floor and person.
    float tFig = 1e9; int who = -1;
    for (int i = 0; i < 2; i++) { float k = figT(ro, rd, uFig[i]); if (k > 0.0 && k < tFig) { tFig = k; who = i; } }
    if (who >= 0 && tFig < length(p - ro)) {
      p = ro + rd * tFig;
      float hy = (p.y - uMin.y) / uFig[who].w;
      vec3 cloth = mix(vec3(0.07, 0.065, 0.06), vec3(0.32, 0.28, 0.23), h21(vec2(uSeed, float(who))));
      vec3 alb = hy > 1.48 ? vec3(0.09, 0.07, 0.06) : hy < 0.9 ? cloth * 0.6 : cloth;
      col = alb * (0.25 + WARM * (lampAt(p) * 0.5 + 0.3));
      ds = vec3(99.0);
    }
    col *= (0.4 + 0.6 * smoothstep(0.0, 1.0, min(min(ds.x, ds.y), ds.z))) * uLight;
    col += gEmit;
    vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// Traced prop per type, [x0, y0, z0, x1, y1, z1, colour], y from the room floor. Skipped when furnished.
const PROPS = {
  bedroom: [-1.0, 0, -4.4, 1.0, 0.55, -2.2, [0.62, 0.58, 0.52]],
  guest: [-0.8, 0, -4.4, 0.8, 0.5, -2.4, [0.55, 0.52, 0.47]],
  family: [-1.6, 0, -0.9, 1.6, 0.8, 0.0, [0.16, 0.14, 0.12]],
  living: [-1.7, 0, 1.6, 1.7, 0.75, 2.6, [0.42, 0.38, 0.33]],
  study: [-0.9, 0, -3.2, 0.9, 0.75, -2.4, [0.2, 0.12, 0.07]],
  gym: [-0.22, 0, -1.0, 0.22, 0.45, 0.6, [0.07, 0.07, 0.07]],
};
const NO_PROP = [0, 0, 0, 0, 0, 0, [0, 0, 0]];
// Where each type's key light sits (bedside, desk, screen), y from the room floor.
const LAMPS = {
  bedroom: [2.75, 0.8, -4.0],
  guest: [2.05, 0.8, -4.0],
  study: [0.6, 1.1, -2.8],
  family: [0, 1.5, -4.0],
  gym: [0, 2.4, 0],
};
export function roomMat(spec, RY0, RY1) {
  // bounds fit the 12.6 × 9.4 curtain wall, centred on the group
  const prop = (!spec.furnish && !spec.theme && PROPS[spec.room]) || NO_PROP;
  return new THREE.ShaderMaterial({
    uniforms: {
      uMin: { value: new THREE.Vector3(-6.3, RY0, -4.45) },
      uMax: { value: new THREE.Vector3(6.3, RY1, 4.7) },
      uLamp: { value: new THREE.Vector3(...(LAMPS[spec.room] ?? [-0.6, 2.2, 0.6])).add(new THREE.Vector3(0, RY0, 0)) },
      uWall: { value: new THREE.Vector3(...spec.wall) },
      uType: { value: ROOM_TYPES[spec.room] },
      uSeed: { value: spec.seed },
      uLight: { value: spec.light },
      uPropMin: { value: new THREE.Vector3(prop[0], RY0 + prop[1], prop[2]) },
      uPropMax: { value: new THREE.Vector3(prop[3], RY0 + prop[4], prop[5]) },
      uProp: { value: new THREE.Vector3(...prop[6]) },
      uFig: spec.figU ?? { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
    },
    vertexShader: ROOM_VERT,
    fragmentShader: ROOM_FRAG,
  });
}
