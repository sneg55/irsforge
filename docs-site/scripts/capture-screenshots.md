# Screenshot capture

Screenshots referenced in the UI section live at:

```
docs-site/static/img/ui/<page>/<page>--<state>.png
```

Until an automated capture script ships, capture manually:

## Setup

1. `make demo` — wait for "Seed complete."
2. Open Chrome at viewport **1440 × 900**, dark mode.
3. Use [agent-browser](https://github.com/anthropics/agent-browser) or any headless capture tool.

## Capture list

### `/demo` — party selector
- `static/img/ui/demo/demo--party-selector.png`

### `/` — workspace (as Goldman/PartyA)
- `static/img/ui/workspace/workspace--irs-composer.png` — IRS, 100M / 5Y filled
- `static/img/ui/workspace/workspace--reference-strip.png` — top-right strip closeup
- `static/img/ui/workspace/workspace--risk-tab.png` — right panel on Risk tab

### `/blotter`
- `static/img/ui/blotter/blotter--full.png` — full table populated
- `static/img/ui/blotter/blotter--exposure-header.png` — header closeup
- `static/img/ui/blotter/blotter--row-drawer.png` — drawer open on a live trade

### `/csa` (as PartyA)
- `static/img/ui/csa/csa--list.png` — list view
- `static/img/ui/csa/csa--drawer-active.png` — drawer open, Active state
- `static/img/ui/csa/csa--amount-modal.png` — Post Collateral amount modal
- `static/img/ui/csa/csa--dispute-modal.png` — Dispute modal
- `static/img/ui/csa/csa--mark-sparkline.png` — sparkline tooltip on hover

### `/csa` (as Operator)
- `static/img/ui/csa/csa--operator-resolve.png` — drawer with Resolve button visible

### FpML
- `static/img/ui/fpml/fpml--import-modal.png` — import modal open from workspace
- `static/img/ui/fpml/fpml--export.png` — blotter row drawer with Export action

### `/org/[orgId]` (when running in `multi` topology)
- `static/img/ui/org/org--landing.png` — single org landing

## Naming convention

- Lowercase.
- `<page>--<state>.png` — double-dash separates page and state.
- PNG, retina (2x) preferred.
