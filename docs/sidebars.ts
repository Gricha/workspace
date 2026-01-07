import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

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
    'cli',
    'web-ui',
    'troubleshooting',
  ],
};

export default sidebars;
