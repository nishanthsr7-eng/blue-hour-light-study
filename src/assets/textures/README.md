# Scanned textures

Four 1K PBR sets from [Poly Haven](https://polyhaven.com), all CC0 (public
domain). Converted to WebP with sharp: colour and roughness at quality 80,
normals at quality 92.

| Set                 | Used for                                   | Tile span |
| ------------------- | ------------------------------------------ | --------- |
| `concrete_pavement` | Terrace and forecourt pavers               | 3 m       |
| `brushed_concrete`  | Slab fascias (relief and roughness only)   | 2.5 m     |
| `oak_veneer_01`     | Oak soffits and timber                     | 1.2 m     |
| `sakura_bark`       | Tree trunks                                | 1 m       |

Every material first renders with its painted, procedural maps and swaps to
the scan once it has loaded, so nothing is ever blank. See
`src/textures/scanned.js` (`useScan`) and `src/world/kit.js`, where the tile
spans are set. Vite fingerprints each file name at build time.
