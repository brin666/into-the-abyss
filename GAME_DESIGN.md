# Into the Abyss — Surface GAME_DESIGN

## Player promise

Look across a large, quiet ocean; watch the fisher cast one line; scroll with that line from the surface to 80 m.

## Core loop

1. Start in a wide surface view.
2. The entry camera approaches automatically; the 3-second rigged cast plays once.
3. Scroll downward to follow the hook through flat 0–80m water.
4. Click/touch a creature at its visible depth to enter its field-guide observation.
5. Close the field guide to return to the same hook position; scroll onward.
6. End at 80m, before the deeper zone begins.

## Must-preserve observable facts

- The boat is the visual anchor.
- The ocean remains alive while the user is not scrolling.
- Entry and cast are automatic once per page visit; no click on fisher is required.
- Upward scrolling at the initial baseline zooms the sea view out without an Alt modifier.
- After the cast, scroll drives one 0–80m hook/depth timeline, with no second cast on return.
- The boat and fisher GLB retains a procedural fallback if its asset fails.

## Whitebox completion

The current playable slice is complete when a clean start, the automatic cast, up-scroll zoom, 80m descent, creature observation, return-to-scroll, and mobile touch path work without runtime errors.

## 0–40m Sunlight Layer Creature Slice

### Experience contract

The first shallow-water passage should feel open, bright, and alive without becoming a fish catalogue. The hook is the player’s visual anchor; creatures briefly cross its path, then leave enough empty water for scale and anticipation.

The sequence is:

`cast → surface particles → baitfish pass → green turtle encounter → open water → moon jelly cluster → sparse 40m handoff`

### Depth pacing

| Depth | World beat | Creature tier | Player-readable response |
|---|---|---|---|
| 0–3m | The line breaks the surface; bubbles and sun shafts | Environment | The cast has entered the water |
| 3–8m | A compact baitfish school crosses the hook | B / shared GLB clones | The water has scale and motion |
| 8–16m | A green sea turtle glides past at a safe distance | S / hero | The first named encounter; slow, calm, memorable |
| 16–24m | Open blue water with sparse particles | Environment | A deliberate breathing space |
| 24–32m | Three moon jellies pulse upward | A / shared GLB clones | Transparent bodies become visual anchors |
| 32–40m | Creature density falls; the hook continues into blue | B / particles | A clean handoff to the next layer |

### MVP creature roster

- **Green sea turtle — Chelonia mydas**: one textured hero GLB, 8–16m encounter, whole-body drift/roll loop in the current build; flipper rig remains future polish.
- **Baitfish school — Clupeidae-like silhouettes**: seven clones of one optimized GLB, 3–8m, one crossing pattern with variation in spacing and phase. Exact species is not claimed.
- **Moon jelly cluster — Aurelia-like jellyfish**: three clones of the existing optimized GLB, 24–32m, scale-and-float pulse loop, subtle translucency; no authored bone rig yet.
- **Plankton and suspended particles**: procedural/instanced background layer across 0–40m; density increases slightly while the scene remains readable.

The dolphin is deferred from the first 0–40m build. It is a good later encounter, but its silhouette, animation, and sound would compete with the turtle’s role as the first hero creature.

### Runtime rules for this slice

- Depth is the single timeline; encounters are read from the hook’s 0–80m progress rather than from separate page sections.
- Loop animations continue while scrolling stops; encounter entrances and exits are progress-controlled.
- Turtle receives the main textured hero treatment; schools reuse one mesh asset and particles remain procedural. Actual GPU instancing is a later optimization if profiling shows it is needed.
- No creature blocks the hook path, and no creature appears continuously. The empty 16–24m and 32–40m intervals are intentional.

### Creature observation interaction

- Baitfish, green sea turtle, and moon jelly are clickable shallow-water targets in the first pass.
- Clicking a visible creature locks page scroll, dims the surrounding water, enlarges the selected creature into an observation view, and opens a compact field note.
- The field note shows common name, scientific name, encounter depth, body length, and one natural-history fact.
- The 0–40m first pass uses optimized GLB assets with CSS fallback silhouettes; future assets keep the same `data-creature` contract.

### Executable verification slice

Start at the surface, wait for the automatic cast, then scroll through the fish school, turtle (~14m), moon jellies (~29m), sunfish (~52m), blue shark (~68m), and finally 80m. At each encounter the selected creature must be clickable, the field guide must open, and closing it must restore the same depth. Sparse water between encounters is intentional.

The v11 vessel clip retains the v10 rod arc—behind the shoulder, up, then forward—and moves the cork from a fingertip-biased contact sample toward the broader visible right-palm region. The fingers are not independently rigged and do not yet form a finished closed grip. The hook line follows `Fisherman_RodTip`; the fisherman does not cast again on a return scroll. v10 and earlier clips remain rollback candidates.

## 40–80m Open Water Slice

| Encounter | Approximate scene depth | Treatment |
|---|---:|---|
| Transition / empty water | 40–47m | Surface boat fully gone; slightly darker blue, sparse particles |
| Ocean sunfish (*Mola mola*) | 48–58m | One slow, broad silhouette and field note |
| Open water | 58–62m | Leave the fish behind; retain the hook as focus |
| Blue shark (*Prionace glauca*) | 62–75m | One distant lateral pass; no jump scare or attack |
| Next-zone pause | 75–80m | Creature density falls to zero |

The encounter depths are narrative placements, not fixed biological limits. [NOAA AFSC](https://apps-afsc.fisheries.noaa.gov/ichthyo/LHDataLH.php?GSID=Mola%21mola) lists ocean sunfish as oceanic epipelagic 0–200m; [NOAA Fisheries](https://www.fisheries.noaa.gov/new-england-mid-atlantic/atlantic-highly-migratory-species/shark-identification-cooperative-shark) lists blue shark offshore from surface to about 600m. Both current models are editable lightweight Blender studies with simple runtime loops, not paid-skill generations. The v4 sunfish has a truncated body/clavus with a softened rear joint, subtly mottled surface, and independently moving dorsal/anal fins; the v2 blue shark exposes the near-side eye and gills and moves its tail from a named pivot. Earlier studies and the v2/v3 sunfish remain rollback assets.
