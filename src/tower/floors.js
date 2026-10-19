import * as THREE from 'three';
import { mulberry, TAU, yieldToBrowser } from '../core/util.js';
import { M } from '../world/materials.js';
import {
  balustrade,
  extrude,
  flat,
  inRRect,
  mullions,
  outlineTube,
  planters,
  rrect,
  soffitLights,
} from '../world/geometry.js';
import { ao, at, building, decal, decalMat, rbox } from '../world/kit.js';
import { anchors, glowPts } from './base.js';
import { BOLT_GEO, coveMat, FH, FRIT, L1, slab } from './slab.js';
import { CURTAINS, FIG_FLOORS, FLOOR_SPECS, FLOORS, LIGHT_STATES, PEOPLE, roomMat } from './rooms.js';
import {
  bake,
  curtain,
  DARK_ROOM,
  ROOMS,
  SHEER,
  SHEER_GLOW,
  sheerWithPeople,
  TERRACE_SETS,
  terraceTrees,
  THEMES,
  trailing,
  trailingFloor,
} from './furniture.js';

function buildFloor(i, spec) {
  const g = new THREE.Group();
  g.position.y = L1 + FH * i;
  g.rotation.y = -0.34 + 0.075 * i;
  g.userData.twistFloor = i;
  building.add(g);
  const w = spec.dims?.w ?? 18 + Math.sin(0.9 * i) * 1.6,
    d = spec.dims?.d ?? 14 + Math.cos(0.7 * i) * 1.3,
    r = 4.6,
    DECK = 0.448;
  FLOORS[i] = { g, w, d, r };
  spec.light ??= LIGHT_STATES[spec.state] ?? 1;
  if (spec.state === 'glow') spec.curtains ??= 'closed';
  const up = FLOORS[i + 1];
  slab(g, w, d, r, coveMat(i === 0 ? 0.95 : 0.6 + 0.4 * (i / 9) ** 1.5));
  // The soffit lights whatever is below: the lobby roof under Level 01, a curtain wall elsewhere.
  soffitLights(g, -0.012, [w, d, r], i === 0 ? [20.4, 14.4, 4.7] : [12.6, 9.4, 3], 1.6);
  g.updateMatrixWorld(true);

  const GH = FH - 0.47,
    G0 = 0.46;
  if (spec.glass) {
    // Placeholder: glass, spandrel and mullions over a dark interior.
    const glassShape = rrect(12.6, 9.4, 3);
    const gl = extrude(glassShape, GH, M.glass, { bevel: 0 });
    gl.castShadow = false;
    gl.position.y = G0;
    g.add(gl);
    const span = extrude(rrect(12.66, 9.46, 3.03), 0.42, M.spandrel, { bevel: 0 });
    span.position.y = G0 + GH - 0.42;
    g.add(span);
    g.add(mullions(glassShape, G0, GH, 1.5, 0.12));
    const dark = extrude(rrect(12.4, 9.2, 2.9), GH - 0.45, DARK_ROOM, { bevel: 0 });
    dark.position.y = G0;
    g.add(dark);
  }
  if (spec.room) {
    // Curtain wall: glass, slim bronze mullions, sill and head frames, a dark
    // spandrel band over the ceiling void, and a slot drain at the sill.
    const glassShape = rrect(12.6, 9.4, 3);
    const gl = extrude(glassShape, GH, M.glass, { bevel: 0 });
    gl.castShadow = false;
    gl.position.y = G0;
    g.add(gl);
    const span = extrude(rrect(12.66, 9.46, 3.03), 0.42, M.spandrel, { bevel: 0 });
    span.position.y = G0 + GH - 0.42;
    g.add(span);
    g.add(mullions(glassShape, G0, GH, 1.5, 0.12));
    g.add(outlineTube(rrect(12.7, 9.5, 3.05), G0 + 0.04, 0.045, M.metal));
    g.add(outlineTube(rrect(12.72, 9.52, 3.06), G0 + GH - 0.44, 0.03, M.metal));
    const drain = rrect(13.3, 10.1, 3.35);
    drain.holes.push(rrect(12.78, 9.58, 3.09, 0, 0, new THREE.Path()));
    const dm = flat(drain, M.grate);
    dm.position.y = DECK + 0.003;
    g.add(dm);
    if (spec.door) {
      // Sliding door to the terrace: heavier bronze stiles and a long pull.
      const s = spec.door;
      for (const z of [-1.5, 0, 1.5])
        at(rbox(0.12, GH - 0.45, 0.16, M.metal, 0.01), s * 6.36, G0 + (GH - 0.45) / 2, z, g);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 10), M.metal), s * 6.46, G0 + 1.1, -0.15, g);
      at(rbox(0.06, 0.03, 3.1, M.metal, 0.008), s * 6.36, G0 + 0.02, 0, g);
    }

    // Bathroom pane on the run opposite the door: a fine dot frit for privacy.
    const fs = -(spec.door ?? (i % 2 ? 1 : -1));
    const frit = at(
      new THREE.Mesh(new THREE.PlaneGeometry(1.5, GH - 0.5), FRIT),
      fs * 6.27,
      G0 + (GH - 0.45) / 2,
      -0.75,
      g,
    );
    frit.rotation.y = (fs * Math.PI) / 2;
    if (i % 3 === 1) {
      // One top-hung pane tilted open on the front run, hinged at the head.
      const hinge = at(new THREE.Group(), 2.25, G0 + GH - 0.47, 4.74, g);
      hinge.rotation.x = -0.16;
      const pane = at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.5), M.glass), 0, -0.75, 0, hinge);
      pane.castShadow = false;
      const fr = at(rbox(1.46, 0.05, 0.05, M.metal, 0.01), 0, -1.5, 0, hinge);
      fr.castShadow = false;
    }

    // The apartment, traced per pixel in the floor's own frame.
    const RY0 = G0 + 0.01,
      RY1 = G0 + GH - 0.43;
    if (PEOPLE[i]) {
      spec.figU = { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] };
      FIG_FLOORS.push({
        i,
        g,
        people: PEOPLE[i],
        figU: spec.figU,
        invU: { value: new THREE.Matrix4() },
        ry0: RY0,
        ry1: RY1,
      });
    }
    const shell = extrude(rrect(12.5, 9.3, 2.95), RY1 - RY0, roomMat(spec, RY0, RY1), { bevel: 0 });
    shell.geometry.translate(0, RY0, 0);
    shell.castShadow = shell.receiveShadow = false;
    g.add(shell);
    if (spec.theme) {
      // Built loose, then merged per material; lamps add halos on lit floors (and the night light).
      const fg = new THREE.Group(),
        lamps = [];
      THEMES[spec.theme](fg, RY0, RY1, (x, y, z) => lamps.push(new THREE.Vector3(x, y, z)));
      const k = spec.state === 'dark' ? 0.035 : 0.06 + 0.08 * Math.min(spec.light, 1.2);
      bake(fg, g, k, spec.room === 'family' && spec.state === 'dark' ? 0x5a8cff : 0xffc48a);
      for (const v of lamps) glowPts.level.push(g.localToWorld(v));
    }
    if (spec.furnish) {
      ROOMS[spec.room](g, RY0, RY1, spec);
      const roomLight = new THREE.PointLight(0xffc48a, 22 * spec.light, 14, 1.6);
      roomLight.position.set(0.5, RY0 + 2.2, 0.5);
      g.add(roomLight);
    }
    const cur = typeof spec.curtains === 'string' ? CURTAINS[spec.curtains] : (spec.curtains ?? []);
    const ff = FIG_FLOORS.find((x) => x.i === i),
      sheerMat = ff
        ? sheerWithPeople(spec.state === 'glow' ? SHEER_GLOW : SHEER, ff)
        : spec.state === 'glow'
          ? SHEER_GLOW
          : SHEER;
    for (const [len, x, z, ry] of cur) {
      const c = curtain(len, RY1 - RY0 - 0.06, sheerMat);
      c.position.set(x, (RY0 + RY1) / 2, z);
      c.rotation.y = ry;
      c.renderOrder = -1;
      g.add(c);
      const rail = at(new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.03, 0.04), M.metal), x, RY1 - 0.02, z, g);
      rail.rotation.y = ry;
    }
  }

  // Terrace: glass balustrade (in a bronze shoe on finished floors), the
  // planter ring, a furniture set, and per-floor planting.
  const t = spec.terrace;
  if (t) {
    g.add(balustrade(w - 0.3, d - 0.3, r - 0.15, DECK));
    if (t.shoe) {
      const shoe = rrect(w - 0.22, d - 0.22, r - 0.11);
      shoe.holes.push(rrect(w - 0.38, d - 0.38, r - 0.19, 0, 0, new THREE.Path()));
      const sh = extrude(shoe, 0.1, M.metal, { bevel: 0 });
      sh.position.y = DECK;
      g.add(sh);
      // Fixing bolts on the shoe's outer face every 1.2 m.
      const ring = rrect(w - 0.21, d - 0.21, r - 0.105),
        nb = Math.floor(ring.getLength() / 1.2),
        bp = ring.getSpacedPoints(nb);
      const bolts = new THREE.InstancedMesh(BOLT_GEO, M.steel, nb),
        m4 = new THREE.Matrix4();
      for (let k = 0; k < nb; k++) bolts.setMatrixAt(k, m4.makeTranslation(bp[k].x, DECK + 0.05, -bp[k].y));
      g.add(bolts);
    }
  }
  if (spec.planting != null) planters(g, rrect(w - 1.3, d - 1.3, r - 0.65), DECK, spec.planting);
  if (t?.set) {
    // Auto-placed: midway across the side terrace on the door side (seating rule for z).
    const side = spec.door ?? (i % 2 ? 1 : -1);
    const [tx, tz] = t.at ?? [side * (6.3 + ((w - 1.3) / 2 - 6.6) / 2), ((i % 4) - 1.5) * 0.8];
    TERRACE_SETS[t.set](g, tx, DECK, tz, side);
  }
  if (spec.tree) {
    // In a front corner between the glass and the planter ring, opposite the set.
    const sx = -(spec.door ?? (i % 2 ? 1 : -1)),
      sz = 1; // front corners face the camera path
    terraceTrees.push({ g, x: sx * 6.35, y: DECK, z: sz * 4.55, seed: 300 + i });
  }
  if (spec.trail) {
    // Trailing plants: clumps hung just outside the fascia, longest mid-run.
    const rnd = mulberry(500 + i),
      edge = rrect(w + 0.12, d + 0.12, r + 0.06);
    const n = Math.floor(edge.getLength() / 0.22),
      pts = edge.getSpacedPoints(n),
      m4 = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler();
    for (let k = Math.floor(spec.trail[0] * n); k < spec.trail[1] * n; k++) {
      if (rnd() < 0.15) continue; // gaps, so it reads as growth rather than a fringe
      const u = (k / n - spec.trail[0]) / (spec.trail[1] - spec.trail[0]);
      const len = (0.25 + 1.1 * Math.pow(Math.sin(u * Math.PI), 0.7)) * (0.4 + 0.6 * rnd());
      const tx = pts[k + 1].x - pts[k].x,
        ty = pts[k + 1].y - pts[k].y,
        tl = Math.hypot(tx, ty) || 1;
      const ox = ty / tl,
        oz = tx / tl; // outward normal in local xz
      const tiers = 1 + Math.ceil(len / 0.28);
      for (let j = 0; j < tiers; j++) {
        const f = j / tiers,
          out = 0.03 + 0.06 * rnd() + f * 0.04,
          sz = (0.15 - f * 0.06) * (0.7 + 0.5 * rnd());
        e.set((rnd() - 0.5) * 0.6, rnd() * TAU, (rnd() - 0.5) * 0.6);
        q.setFromEuler(e);
        m4.compose(
          new THREE.Vector3(
            pts[k].x + ox * out + (rnd() - 0.5) * 0.12,
            DECK - 0.02 - f * len,
            -pts[k].y + oz * out + (rnd() - 0.5) * 0.12,
          ),
          q,
          new THREE.Vector3(sz, sz * (1.3 + rnd()), sz),
        );
        trailing.push(m4.clone().premultiply(g.matrixWorld));
        trailingFloor.push(i);
      }
    }
  }

  if (spec.room) {
    // Light on the terrace: the room's spill through the glass and soft contact at the sill.
    ao({ kind: 'outside', w: 12.78, d: 9.58, r: 3.09, reach: 0.5, strength: 0.35 }, 0, DECK + 0.004, 0, 0, g);
    decal(
      {
        kind: 'outside',
        w: 12.78,
        d: 9.58,
        r: 3.09,
        reach: 2.6,
        strength: 0.28 * Math.min(spec.light, 1),
        color: 0xffbf86,
      },
      0,
      DECK + 0.005,
      0,
      0,
      g,
    );
  }
  if (up && spec.room) {
    // A pool under every soffit downlight of the floor above (same grid as its soffitLights).
    const pools = [],
      v = new THREE.Vector3();
    for (let x = -up.w / 2; x <= up.w / 2; x += 1.6)
      for (let z = -up.d / 2; z <= up.d / 2; z += 1.6) {
        if (!inRRect(x, z, up.w - 0.9, up.d - 0.9, up.r - 0.45) || inRRect(x, z, 13.1, 9.9, 3.25)) continue;
        v.set(x, -0.012, -z);
        up.g.localToWorld(v);
        g.worldToLocal(v);
        if (!inRRect(v.x, -v.z, w - 1.6, d - 1.6, r - 0.8) || inRRect(v.x, -v.z, 13.6, 10.4, 3.5)) continue;
        pools.push(new THREE.Matrix4().makeTranslation(v.x, DECK + 0.006, v.z));
      }
    const pm = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2),
      decalMat({ reach: 1.2, strength: 0.42 }),
      pools.length,
    );
    pools.forEach((m4, k) => pm.setMatrixAt(k, m4));
    pm.renderOrder = -2;
    g.add(pm);
  }
  if (spec.note) anchors[spec.note] = g.localToWorld(new THREE.Vector3(6.3, 2.0, 2.0));
}
// Top-down, so each floor can place the light pools from the soffit above it.
for (const spec of [...FLOOR_SPECS].sort((a, b) => b.i - a.i)) {
  buildFloor(spec.i, spec);
  await yieldToBrowser();
}
