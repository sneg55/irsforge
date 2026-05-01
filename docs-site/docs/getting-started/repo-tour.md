---
title: Repo Tour
---

# Repo Tour

```
noders/
├── irsforge.yaml           ← single source of truth for config
├── Makefile                ← top-level orchestration (setup, dev, demo, test, docs)
├── contracts/              ← Daml contracts (build with `daml build`)
│   └── src/
│       ├── Csa/            ← CSA, Mark, Netting, Shortfall, signed CSB model
│       ├── Swap/           ← IRS / OIS / Basis / XCCY / CDS / FpML proposals + workflow
│       ├── Oracle/         ← Curve, CurveSnapshot, FxSpot
│       └── Setup/          ← Init, GeneratedConfig (codegen target), DemoSeed, RoleSetup
├── oracle/                 ← TypeScript oracle service (build with `npm run build`)
│   └── src/
│       ├── services/
│       │   ├── mark-publisher/    ← compute marks, publish to CSA
│       │   ├── scheduler/         ← trigger lifecycle, settle net, mature
│       │   ├── ledger-publisher.ts
│       │   ├── sofr-service.ts
│       │   └── demo-curve-ticker.ts
│       ├── providers/      ← live data sources (nyfed, ...)
│       ├── authz/          ← JWT validation
│       └── api/            ← HTTP endpoints
├── app/                    ← Next.js 16 App Router frontend (React 19)
│   └── src/
│       ├── app/            ← thin route files
│       │   ├── page.tsx                ← redirects / to /org
│       │   ├── api/{ledger,oracle,config}/  ← Canton + oracle proxies
│       │   ├── demo/                   ← party selector wrapper
│       │   └── org/[orgId]/            ← per-org landing
│       ├── features/       ← feature modules
│       │   ├── workspace/  ← leg composer + pricing tabs
│       │   ├── blotter/    ← positions table + exposure header
│       │   ├── csa/        ← CSA list + funding + dispute UI
│       │   ├── fpml-import/ + fpml-export/
│       │   └── party-selector/
│       └── shared/         ← ledger client, config context, primitives
├── shared-config/          ← YAML schema (Zod) + loader + Daml codegen
│   └── src/
│       ├── schema*.ts      ← per-section Zod schemas
│       ├── loader.ts       ← reads irsforge.yaml, validates, resolves
│       └── codegen.ts      ← emits Setup/GeneratedConfig.daml
├── auth/                   ← JWT issuer for builtin/OIDC modes
├── shared-pricing/         ← pricing engine (vitest)
└── docs-site/              ← this site (Docusaurus)
```

## Build boundaries

Each top-level dir is independently buildable. CI builds them in dependency order:

```
shared-config  →  contracts  →  app + oracle + auth
                       ↓
                shared-pricing (consumed by app + oracle)
```

`make build` runs all of this in the right order. `make setup` does it once at install.

## Conventions

- Feature-based file organisation within each build boundary.
- Zero magic strings — constants files per feature.
- Files under 200 lines preferred; extract at ~300 lines (a hook enforces 300 hard).
- Types colocated per feature, not in a global types file.
