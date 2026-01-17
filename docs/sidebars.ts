import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
import apiSidebar from './docs/api/sidebar';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    'installation',
    'getting-started',
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/environment',
        'configuration/files',
        'configuration/github',
        'configuration/ai-agents',
        'configuration/tailscale',
      ],
    },
    {
      type: 'category',
      label: 'CLI Reference',
      link: {
        type: 'doc',
        id: 'cli',
      },
      items: [],
    },
    {
      type: 'category',
      label: 'Common Workflows',
      items: [
        'workflows/cloning',
        'workflows/dev-environment',
        'workflows/port-forwarding',
        'workflows/multi-workspace',
        'workflows/ai-agents',
      ],
    },
    'web-ui',
    'troubleshooting',
    {
      type: 'category',
      label: 'API Reference',
      link: {
        type: 'generated-index',
        title: 'Perry API Reference',
        description: 'Auto-generated reference for internal Perry APIs. These APIs are used by the CLI and Web UI and are not intended for direct use.',
        slug: '/api',
      },
      items: apiSidebar,
    },
  ],
};

export default sidebars;
