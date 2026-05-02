import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'IRSForge',
  tagline: 'On-chain Interest Rate Swaps for Canton Network',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://noders.github.io',
  baseUrl: '/',

  organizationName: 'sneg55',
  projectName: 'noders',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownImages: 'warn',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/sneg55/irsforge/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'IRSForge',
      items: [
        { type: 'docSidebar', sidebarId: 'main', position: 'left', label: 'Docs' },
        { to: '/judges/quickstart', label: 'For Judges', position: 'left' },
        {
          href: 'https://github.com/sneg55/irsforge',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Quickstart', to: '/getting-started/quickstart' },
            { label: 'Demo vs Production', to: '/concepts/demo-vs-production' },
            { label: 'Config reference', to: '/reference/config-yaml' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: 'https://github.com/sneg55/irsforge' },
            { label: 'IRSForge', href: 'https://irsforge.com' },
          ],
        },
      ],
      copyright: `On-chain Interest Rate Swap platform for Canton Network.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['haskell', 'bash', 'yaml', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
