import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api/perry-api",
    },
    {
      type: "category",
      label: "Configuration",
      link: {
        type: "doc",
        id: "api/configuration",
      },
      items: [
        {
          type: "doc",
          id: "api/config-credentials-get",
          label: "config.credentials.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-credentials-update",
          label: "config.credentials.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-scripts-get",
          label: "config.scripts.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-scripts-update",
          label: "config.scripts.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-agents-get",
          label: "config.agents.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-agents-update",
          label: "config.agents.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-skills-get",
          label: "config.skills.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-skills-update",
          label: "config.skills.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-mcp-get",
          label: "config.mcp.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-mcp-update",
          label: "config.mcp.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-ssh-get",
          label: "config.ssh.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-ssh-update",
          label: "config.ssh.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-ssh-list-keys",
          label: "config.ssh.listKeys",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-terminal-get",
          label: "config.terminal.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-terminal-update",
          label: "config.terminal.update",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-tailscale-get",
          label: "config.tailscale.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/config-tailscale-update",
          label: "config.tailscale.update",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "GitHub",
      link: {
        type: "doc",
        id: "api/git-hub",
      },
      items: [
        {
          type: "doc",
          id: "api/github-list-repos",
          label: "github.listRepos",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Host",
      link: {
        type: "doc",
        id: "api/host",
      },
      items: [
        {
          type: "doc",
          id: "api/host-info",
          label: "host.info",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Info",
      link: {
        type: "doc",
        id: "api/info",
      },
      items: [],
    },
    {
      type: "category",
      label: "Models",
      link: {
        type: "doc",
        id: "api/models",
      },
      items: [
        {
          type: "doc",
          id: "api/models-list",
          label: "models.list",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Sessions",
      link: {
        type: "doc",
        id: "api/sessions",
      },
      items: [
        {
          type: "doc",
          id: "api/sessions-list",
          label: "sessions.list",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-get",
          label: "sessions.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-rename",
          label: "sessions.rename",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-clear-name",
          label: "sessions.clearName",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-get-recent",
          label: "sessions.getRecent",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-record-access",
          label: "sessions.recordAccess",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-delete",
          label: "sessions.delete",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/sessions-search",
          label: "sessions.search",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Workspaces",
      link: {
        type: "doc",
        id: "api/workspaces",
      },
      items: [
        {
          type: "doc",
          id: "api/workspaces-list",
          label: "workspaces.list",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-get",
          label: "workspaces.get",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-create",
          label: "workspaces.create",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-clone",
          label: "workspaces.clone",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-delete",
          label: "workspaces.delete",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-start",
          label: "workspaces.start",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-stop",
          label: "workspaces.stop",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-logs",
          label: "workspaces.logs",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-sync",
          label: "workspaces.sync",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-sync-all",
          label: "workspaces.syncAll",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-touch",
          label: "workspaces.touch",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-get-port-forwards",
          label: "workspaces.getPortForwards",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-set-port-forwards",
          label: "workspaces.setPortForwards",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-update-worker",
          label: "workspaces.updateWorker",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api/workspaces-exec",
          label: "workspaces.exec",
          className: "api-method post",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
