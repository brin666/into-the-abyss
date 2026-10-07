# Into the Abyss — Surface Design Contract

## Visual direction

- Quiet, open ocean with a restrained editorial HUD.
- The boat is small against the water and remains the compositional anchor.
- The surface palette is pale sky, muted teal water, warm wood, and a single warm cast accent.
- Motion is continuous but subtle: wave displacement, boat bob, wake breathing, a rigged three-second cast, and creatures that keep moving when scrolling stops.

## Interaction direction

- The entry camera and single cast begin automatically; the surface should not imply a required click on the fisher.
- Up-scroll from the initial baseline zooms out, down-scroll after the cast descends; dragging the surface changes the camera angle.
- The flat transition boat must not linger over the 3D boat during the cast.
- In the cast's key poses, the rod must stay in the visible right hand; the backswing tip points upward rather than through the deck, and the forward arc stays clear of the boat. Assess the actual in-page silhouette as well as isolated rig contact numbers.
- The v11 palm-contact correction is only a placement improvement: do not mistake a low contact-distance metric for a closed finger grip. Review the whole hand and reel in close-up before final art acceptance.
- Do not introduce menus, game controls, or free movement.

## Creature encyclopedia

- A creature click keeps the underwater observation composition and opens a right-side field-guide panel; on narrow screens it becomes a bottom sheet so the animal remains visible above it.
- Lead with the common Chinese name, English name, and italic scientific name. Separate the live simulated depth and encounter band from biological habitat notes so the scene's chosen depth is not presented as a species limit.
- Keep the source link, field note, and fixed return action inside the panel. Escape and the return buttons close the note and restore focus to the creature that opened it.
- Use the existing deep teal, sea-glass, and warm chart accent; text and controls remain HTML rather than being baked into an image.
- For 40–80m, shift toward deeper blue without making the sunlit ocean black. Keep the hook line readable and give sunfish/shark enough space not to overlap the field-guide panel.
- In observation mode, the 40–80m models must read at actual desktop and 390px mobile sizes: the sunfish's tall opposed fins and truncated rear, and the shark's long pectoral, near-side eye/gills, and attached moving tail are the silhouette checks. Keep their loop motion slow enough to feel like swimming, not UI decoration.
- A model-loading failure keeps the CSS silhouette and click target. A late GLB load enters at the current depth and target screen position rather than sliding in from the screen center.

## Future handoff

The hook and line are named scene objects; the vessel GLB includes `Fisherman_RodTip` for a real rig-following attachment. The 80m endpoint is a deliberate handoff: further zones can extend the same scroll-depth clock without resetting the opening or recasting.
