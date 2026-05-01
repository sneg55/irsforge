import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  main: [
    'intro',
    {
      type: 'category',
      label: 'For Judges',
      collapsed: false,
      items: ['judges/quickstart', 'judges/tour'],
    },
    {
      type: 'category',
      label: 'By Role',
      collapsed: false,
      items: [
        'risk-and-controls',
        'compliance-and-audit',
        'security-and-trust',
        'comparison',
        'faq',
      ],
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/quickstart', 'getting-started/repo-tour'],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/swpm-parity',
        'concepts/demo-vs-production',
        'concepts/topology',
        'concepts/parties-and-auth',
        'concepts/operator-role',
        'concepts/csa-model',
        'concepts/swap-lifecycle',
        'concepts/pricing-and-curves',
        'concepts/registering-a-provider',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/daml-finance-interfaces'],
    },
    {
      type: 'category',
      label: 'Products',
      items: ['products/irs', 'products/ois', 'products/basis', 'products/xccy', 'products/cds'],
    },
    {
      type: 'category',
      label: 'Integrators (BYO)',
      items: [
        'integrators/overview',
        'integrators/byo-auth',
        'integrators/byo-oracle',
        'integrators/byo-topology',
      ],
    },
    {
      type: 'category',
      label: 'Oracle',
      items: [
        'oracle/overview',
        'oracle/mark-publisher',
        'oracle/scheduler',
        'oracle/sofr-service',
        'oracle/demo-curve-ticker',
        'oracle/providers',
      ],
    },
    {
      type: 'category',
      label: 'UI',
      items: [
        'ui/overview',
        'ui/workspace',
        'ui/blotter',
        'ui/csa',
        'ui/ledger',
        'ui/fpml-import-export',
        'ui/party-selector',
        'ui/org-page',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/config-yaml',
        'reference/config-recipes',
        'reference/cli-and-make',
        'reference/api-endpoints',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'operations/deploying-production',
        'operations/canton-network-runbook',
        'operations/service-accounts',
        'operations/monitoring',
      ],
    },
  ],
}

export default sidebars
