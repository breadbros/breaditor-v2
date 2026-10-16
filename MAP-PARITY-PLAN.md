# Farmsville visual parity and acceptance

Status: accepted by the user on 2026-10-16 ("verified") following the Farmsville visual-parity and legacy save/load checklist. No discrepancies were reported. This records human acceptance separately from the automated bridge/waterfall/canopy fixtures.

## Work

1. Capture matching views of bridges, waterfalls, parallax layers, and Oak/tree canopies in Breaditor and the reference renderer. Record source revisions, camera, scale, and animation time where controllable. Reuse the observational `--farmsville` captures as starting points; add a moving-camera sequence for parallax.
2. Review images side by side. Track each mismatch with a location, expected behavior, and reference evidence. Resolve the known Oak atlas-padding ambiguity without rewriting bundled source assets.
3. Fix confirmed renderer differences in `crustacean-map-lib`; fix editor integration differences in Breaditor. Add focused new regressions. Existing test or golden changes require approval.
4. On isolated copies, exercise a practical legacy-map edit: paint tiles, move an entity, change an obstruction/zone, undo/redo, Save As, reopen, and load the saved legacy map in Sully. Keep extended format-v2 acceptance separate from unchanged Sully compatibility.
5. Run checks appropriate to the changes, publish any library fix, update Breaditor's immutable pin, and prepare the map work for review.

## Acceptance

- Reference comparisons account for bridge ordering, waterfall timing, parallax, hitbox origins, canopy redraw, and Oak padding.
- Every visible discrepancy is fixed or explicitly accepted with evidence.
- A saved legacy-map edit opens correctly in Breaditor and Sully.
- Source-game files and byte-preserved bundled assets remain intact.
- Automated results and human visual acceptance are recorded separately.

# HUMAN QUESTIONS

No blocking decisions remain following user verification. Preserve the accepted rendering behavior and original assets. The Oak padding diagnostic remains; verification does not establish whether its source data was intentional.
