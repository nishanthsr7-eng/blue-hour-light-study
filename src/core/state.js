/* Look-and-light state that several modules change: the season (setSeason
   in seasons.js), the P light pattern (controls.js), and the flag that asks
   lightUp() to recompute the zones (light-study.js). */
export const state = { season: { snow: 0 }, seasonIndex: 0, pattern: false, lightDirty: true };
