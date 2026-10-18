import * as THREE from 'three';
import { MAX_ANISO } from '../core/util.js';
import { renderer } from '../core/scene.js';

/**
 * Scanned PBR sets (Poly Haven, CC0; 1K WebP in src/assets/textures). Each material
 * first paints with its procedural maps, then swaps to the scan once loaded,
 * so nothing ever renders blank. `metres` is the real-world span of one tile;
 * `maps` picks which channels to take (the facade keeps its cream colour map
 * and borrows only the scan's relief and roughness).
 */
const scanLoader = new THREE.TextureLoader();
// Vite fingerprints every file; look each one up by its plain name.
const SCAN_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/textures/*.webp', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.split('/').pop(), url],
  ),
);
export function useScan(mat, name, metres, maps = ['map', 'normalMap', 'roughnessMap']) {
  const file = { map: 'diff', normalMap: 'nor', roughnessMap: 'rough' };
  for (const key of maps) {
    scanLoader.load(SCAN_URLS[`${name}_${file[key]}.webp`], (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / metres, 1 / metres);
      t.anisotropy = MAX_ANISO;
      if (key === 'map') t.colorSpace = THREE.SRGBColorSpace;
      renderer.initTexture(t); // upload now, not inside the next visible frame
      mat[key] = t;
      if (key === 'roughnessMap') mat.roughness = 1;
      mat.needsUpdate = true;
    });
  }
}
