import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Introduction',
      items: [
        'introduction',
        'getting-started',
        'quick-start',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'concepts/workspaces',
        'concepts/architecture',
        'concepts/docker-in-docker',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/environment-variables',
        'configuration/credential-files',
        'configuration/user-scripts',
      ],
    },
    {
      type: 'category',
      label: 'AI Coding Agents',
      items: [
        'agents/overview',
        'agents/claude-code',
        'agents/opencode',
        'agents/github',
        'agents/sessions',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/web-ui',
        'guides/cli',
        'guides/tui',
        'guides/terminal-access',
        'guides/port-forwarding',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/custom-images',
        'advanced/networking',
        'advanced/volumes',
        'advanced/security',
      ],
    },
    {
      type: 'doc',
      id: 'troubleshooting',
    },
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/overview',
        'api/authentication',
      ],
    },
    {
      type: 'category',
      label: 'Endpoints',
      items: [
        'api/endpoints/workspaces',
        'api/endpoints/sessions',
        'api/endpoints/config',
        'api/endpoints/terminal',
      ],
    },
    {
      type: 'category',
      label: 'Types',
      items: [
        'api/types',
      ],
    },
  ],
};

export default sidebars;
