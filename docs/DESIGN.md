# Design

What the piece is and the rules it keeps.

## Concept

**A study, not a website.** One building, one evening, one idea: light is the
thing that moves. There is no navigation, marketing copy or call to action.
The interface is a few instruments around the scene: a title, a clock, a
lit-floor count, a time scale and some toggles.

- **Subject:** Residence 07, eleven twisting white slabs on a glazed lobby,
  ending in a penthouse with a pool and a floating roof.
- **Moment:** a clear night just after rain, opening at blue hour.
- **Focus:** the house is the whole story. Mountains, sky and meadow are kept
  darker, hazier and lower in contrast, so nothing competes with a lit window.

## Visual language

| Token    | Value     | Used for                                                   |
| -------- | --------- | ---------------------------------------------------------- |
| Ink      | `#000`    | Page ground                                                |
| Bone     | `#F4F4F6` | Text, at full, 62 % and 34 % strength                      |
| Red      | `#DE4758` | The one accent: whatever is live or active, and the beacon |
| Hairline | 12 % bone | Rules and the flight rail                                  |

- **Type:** Inter, self-hosted. Large numbers at weight 200 with tight
  tracking; labels small, uppercase and widely tracked; tabular figures so
  the clock never jitters.
- **Emphasis comes from weight and contrast, not colour.**
- **Light:** every architectural light is 2700 K warm white. Moonlight is the
  only cool light, and the beacon the only red.
- **Motion:** one easing curve everywhere, a quick start and a long settle.

## The house

Ten residential floors, each a different home with its own palette,
furniture, curtains, terrace and planting: a living room, a primary suite, a
library, a media den, a collector's salon, a guest suite, a wellness studio,
a children's room, an architect's atelier and an entertaining floor. Each is
one row of `FLOOR_SPECS` in `src/tower/rooms.js`.

The rooms behind the glass are ray-traced boxes in a fragment shader (floor,
ceiling, feature wall, lamps, sheers) that write real depth, so modelled
furniture sits inside them correctly. Residents walk, pause and show as
silhouettes on the curtains.

## The evening

| Clock         | What happens                                                    |
| ------------- | --------------------------------------------------------------- |
| 18:56         | Blue hour, the house dark                                       |
| First seconds | The lobby, a line of light up the lift shaft, then floors 01–10 |
| 19:42         | The penthouse and beacon are lit; the timeline holds here       |
| 20:35 → 00:20 | Residents turn in and floors go dark one by one                 |

Two floors stay dark by design (a media den lit by its screen and a
children's room with a night light), so a fully lit evening reads **09 / 11**.

## Seasons and weather

**S** cycles Autumn, Winter, Spring and Summer. Each season sets sky, cloud,
moonlight, fog, exposure, foliage and something in the air: leaves, snow,
blossom or fireflies. A change is staged (sky first, foliage last) rather
than cross-faded. Rain turns up the pool ripples and spreads puddles; in
winter it becomes snow, which settles over about 30 seconds.

## Sound

Off until asked for, and synthesised: a low night bed, rain, wind or crickets
by season, and a click and hum as each floor switches on, pitched up a
pentatonic climb. A fully lit tower is a chord.

## Accessibility

Every animation respects `prefers-reduced-motion`: no camera drift, people
stand still, seasons cut instead of fading and the beacon holds steady. The
controls are keyboard-accessible, and the scene has a text description for
screen readers.
