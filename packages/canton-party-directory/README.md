# canton-party-directory

Human-readable party names for Canton Network apps.

Canton party identifiers are opaque strings like `PartyA::122020ad6b890abe...`. This package resolves them to display names like "Goldman Sachs" — with a React component that handles tooltips, copy-to-clipboard, and graceful fallbacks.

## Quick Start

```tsx
import { PartyDirectoryProvider } from 'canton-party-directory/react';
import { PartyName } from 'canton-party-directory/ui';

function App() {
  return (
    <PartyDirectoryProvider
      entries={[
        { identifier: 'PartyA::1220...', displayName: 'Goldman Sachs', hint: 'PartyA' },
      ]}
      proxyUrl="/api/ledger"
      token={myToken}
    >
      <PartyName identifier="PartyA::1220..." />
      {/* Renders: Goldman Sachs */}
    </PartyDirectoryProvider>
  );
}
```

## Core API (Framework-Agnostic)

```typescript
import { PartyDirectory } from 'canton-party-directory';

const dir = new PartyDirectory({
  entries: [
    { identifier: 'PartyA::1220...', displayName: 'Goldman Sachs', hint: 'PartyA' },
  ],
});

dir.displayName('PartyA::1220...');  // "Goldman Sachs"
dir.displayName('PartyB::abcd...');  // "PartyB" (hint fallback)
dir.displayName('deadbeef1234');      // "deadbeef12..." (truncated)
```

### Canton Sync

```typescript
const dir = new PartyDirectory({
  ledgerUrl: 'http://localhost:7575',
  token: 'your-jwt-token',
});

await dir.sync();  // Fetches from Canton /v1/parties
dir.displayName('PartyA::1220...');  // Now resolved
```

## React Integration

```tsx
import { PartyDirectoryProvider, usePartyDirectory } from 'canton-party-directory/react';

// In your component:
const { displayName, loading } = usePartyDirectory();
const name = displayName('PartyA::1220...');  // "Goldman Sachs"
```

## \<PartyName> Component

```tsx
import { PartyName } from 'canton-party-directory/ui';

<PartyName identifier="PartyA::1220..." />
// Goldman Sachs (hover: full ID tooltip, click: copy)

<PartyName identifier="PartyA::1220..." variant="full" />
// Goldman Sachs (PartyA)

<PartyName identifier="PartyA::1220..." variant="badge" />
// [GS] Goldman Sachs
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| identifier | string | required | Canton party identifier |
| variant | "default" \| "full" \| "badge" | "default" | Display variant |
| copyable | boolean | true | Click to copy full identifier |
| tooltip | boolean | true | Hover to show full identifier |
| className | string | — | CSS class passthrough |

## Customization

Override CSS custom properties:

```css
:root {
  --canton-party-name-color: inherit;
  --canton-party-hint-color: #888;
  --canton-party-tooltip-bg: #1a1a2e;
  --canton-party-tooltip-color: #e0e0e0;
  --canton-party-badge-bg: #2a2a4a;
  --canton-party-badge-color: #a0a0d0;
}
```

## License

Apache-2.0
