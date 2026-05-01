---
title: FpML Import / Export
---

# FpML Import / Export

IRSForge speaks FpML for trade interchange. Two consumer-facing surfaces:

## Import

**Where:** workspace top bar → "Import FpML" button (draft mode only).

![FpML import modal](/img/ui/fpml/fpml--import-modal.png)

| Action | Effect |
|---|---|
| Drop / paste FpML XML | Parses to internal trade shape |
| **Hydrate** | Loads as a workspace draft — all fields editable |
| Cancel | Closes modal |

The hydrated draft is **not** on-chain — it's a pre-trade scratch. To commit, propose it from the workspace as you would any draft.

Source: `app/src/features/fpml-import/`.

## Export

**Where:** blotter row drawer → "Export FpML" action.

![FpML export](/img/ui/fpml/fpml--export.png)

Generates an FpML XML representation of the on-chain trade and downloads it. Round-trip property: a freshly exported trade re-imported should hydrate to the same fields.

Source: `app/src/features/fpml-export/`.

## Mapping

The FpML mapping covers IRS, OIS, BASIS, XCCY (the latter two via the FpML factory path on-chain). CDS FpML is partial — pending Phase 9.
