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
        'configuration/ai-agents',
      ],
    },
    'cli',
    'web-ui',
    'troubleshooting',
  ],
};

export default sidebars;
