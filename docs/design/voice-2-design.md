# Voice 2 design: "Paper & Ink"

Status: implemented on branch `voice2-transformation` (the new board, Personalise, sheets).
The Classic board is unchanged and still selectable.

## Directions considered (2026-10-03)
Mock-ups with real vocabulary: `directions.html` / `directions.png`.

| | A · Paper & Ink (chosen) | B · Soft Shapes | C · Night Signal |
|---|---|---|---|
| Idea | Warm paper, ink text, ONE signal colour for Speak and selection | Rounded, saturated-pastel filled tiles, coral Speak pill | Dark-first, mono tiles with category dots, mint signal |
| Clarity | High: Speak is the only saturated control; categories shown by edge + well | High for children; colour fills compete with symbols | Medium: category salience low (dots only) |
| Distinctiveness | Editorial, calm; not a stock "AAC rainbow" | Friendly but common in children's apps | Sleek but generic "dark dashboard" |
| Accessibility | All pairs AA (tested); works in light, dark and high contrast | AA possible; feels juvenile for adults | Light theme weak; dots too small for low vision |
| Both audiences | Yes, via mode "skins" (see below) | Child only | Adult only |
| Feasibility | Pure RN styles, system fonts | Same | Same |

**Decision:** A as the system. Child mode borrows B's warmth inside A's rules
(soft category fills, rounder corners, larger symbols) so the two modes feel
intentionally different but are one product.

## System
- Tokens: `src/design/tokens.js` (colour schemes light/dark/highContrast, category colours, spacing, shape per mode, type scale, touch targets, motion).
- Components: `src/design/components.js` — Tile, ActionButton, SuggestionChip, Sheet, Segmented, SwitchRow, Card, Notice, EmptyState, ListRow.
- `usePaper()` gives the current scheme, mode shape, text scale and the system reduced-motion flag.
- Type: system font only (no font download, nothing to license, no startup cost). Message 26/34 bold; tiles 15–17 semibold; all scaled by the user's text size.
- Touch: 48 dp minimum for every control, 56 dp for Speak/Delete/Clear/Undo.
- Motion: tile press scale 0.95 over 90 ms plus a signal-tint overlay; with reduced motion only the tint (no scale). Sheets slide (platform default). No decorative animation around vocabulary.
- Suggestions: dashed outline chips, never filled, so they never look like board words.
- Focus: `focus` colour (orange / amber / cyan in HC) distinct from the signal colour; 4 px ring on tiles, chips and controls while scanning.

## Board composition (new board)
Top bar (mode pill, Find, More, Settings) → message stage (2 lines, Speak/Stop, Delete, Clear, Undo) → tool row (Explain, Phrases, Saved, Show) → fixed-height suggestion row → page row → grid.
Nothing above the grid changes height while composing; predictions never reorder the grid.
Options: controls at the bottom (one hand); tablets get a two-pane layout with recent messages in the left column.

## Symbols
ARASAAC pictograms, optional download (Personalise › Picture symbols). Mapping in `src/data/symbolMap.json`, built by `scripts/build-symbol-map.js`; wrong best-search matches were reviewed by eye on a contact sheet and overridden (e.g. "Can I" was a tin can, "stop" a bus stop) or left label-only ("the"). No generated imagery is used for communication symbols.
