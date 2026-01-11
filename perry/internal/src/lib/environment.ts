import { promises as fs } from "fs";

const SYSTEM_VARS = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "PWD",
  "OLDPWD",
  "TERM",
  "COLORTERM",
  "SHLVL",
  "HOSTNAME",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "_",
  "LS_COLORS",
  "LESSOPEN",
  "LESSCLOSE",
  "XDG_SESSION_ID",
  "XDG_RUNTIME_DIR",
  "XDG_DATA_DIRS",
  "XDG_CONFIG_DIRS",
  "DBUS_SESSION_BUS_ADDRESS",
  "SSH_CLIENT",
  "SSH_CONNECTION",
  "SSH_TTY",
  "SSH_AUTH_SOCK",
  "MAIL",
  "MOTD_SHOWN",
  "DOCKER_HOST",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
  "DOCKER_BUILDKIT",
  "COMPOSE_DOCKER_CLI_BUILD",
  "BUN_INSTALL",
  "GOPATH",
  "GOROOT",
  "NVM_DIR",
  "NVM_BIN",
  "NVM_INC",
  "NODE_PATH",
  "WORKSPACE_HOME",
  "WORKSPACE_RUNTIME_CONFIG",
  "HOST_HOME",
  "HOST_UID",
  "HOST_GID",
  "GIT_REPO",
  "BRANCH",
  "WORKSPACE_REPO_URL",
  "WORKSPACE_REPO_BRANCH",
  "SSH_PUBLIC_KEY",
]);

const shouldIncludeVar = (key: string): boolean => {
  if (SYSTEM_VARS.has(key)) {
    return false;
  }
  if (key.startsWith("PERRY_INTERNAL_")) {
    return false;
  }
  return true;
};

const escapeValue = (value: string): string => {
  if (value.includes("\n") || value.includes('"') || value.includes("'")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  if (value.includes(" ") || value.includes("$") || value.includes("`")) {
    return `"${value}"`;
  }
  return value;
};

export const writeEnvironmentFile = async (
  vars: Record<string, string | undefined>,
  filePath = "/etc/environment"
): Promise<void> => {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      continue;
    }
    if (!shouldIncludeVar(key)) {
      continue;
    }
    lines.push(`${key}=${escapeValue(value)}`);
  }
  lines.sort();
  const content = lines.length ? `${lines.join("\n")}\n` : "";
  await fs.writeFile(filePath, content, "utf8");
};
