import { promises as fs } from "fs";
import path from "path";
import { buildBootstrapEntries, runBootstrapScripts } from "../lib/bootstrap";
import { installDevTools } from "../lib/devtools";
import { pathExists, readFileLines } from "../lib/fs";
import { configureGitSshKey, copyGitConfig, ensureKnownHost } from "../lib/git";
import { installLazyVim } from "../lib/lazyvim";
import { CommandError, runCommand } from "../lib/process";
import { loadRuntimeConfig, type RuntimeConfig } from "../lib/runtime";
import { configureShellHelpers } from "../lib/shell-helpers";

const resolveCloneArgs = (config: RuntimeConfig | null) => {
  const raw = config?.workspace?.repo?.cloneArgs;
  if (!Array.isArray(raw)) {
    return [] as string[];
  }
  return raw.map((arg) => (typeof arg === "string" ? arg.trim() : "")).filter((arg) => arg);
};

const logRuntimeConfigContents = async (runtimeConfigPath: string) => {
  if (!(await pathExists(runtimeConfigPath))) {
    console.log(`WARNING: Runtime config not found at ${runtimeConfigPath}`);
    return;
  }
  console.log(`Runtime config loaded from: ${runtimeConfigPath}`);
  console.log("--- Runtime Config Contents ---");
  const lines = await readFileLines(runtimeConfigPath);
  for (const line of lines) {
    if (line.trim()) {
      console.log(`  ${line}`);
    }
  }
  console.log("--- End Runtime Config ---");
};

const logSelectedKey = async (workspaceHome: string, selectedKey: string) => {
  if (!selectedKey) {
    console.log("  Decision: No SSH key selected in runtime config");
    if (process.env.SSH_AUTH_SOCK && await pathExists(process.env.SSH_AUTH_SOCK)) {
      console.log(`  Fallback: Using SSH agent at ${process.env.SSH_AUTH_SOCK}`);
    } else {
      console.log("  WARNING: No SSH agent available, clone may fail");
    }
    return;
  }
  console.log(`  Decision: Using selected key from runtime config: ${selectedKey}`);
  const keyPath = path.join(workspaceHome, ".ssh", selectedKey);
  if (!(await pathExists(keyPath))) {
    console.log(`  ERROR: Selected SSH key not found at ${keyPath}`);
    if (await pathExists(path.join(workspaceHome, ".ssh"))) {
      const entries = await fs.readdir(path.join(workspaceHome, ".ssh"));
      console.log("  Available keys in ~/.ssh/:");
      for (const entry of entries) {
        if (!entry.endsWith(".pub") && !["known_hosts", "config", "authorized_keys"].includes(entry)) {
          console.log(`    ${entry}`);
        }
      }
    }
    return;
  }
  const keyContent = await fs.readFile(keyPath, "utf8");
  const keyType = keyContent.split(" ")[0] || "unknown";
  console.log(`  Key file exists at: ${keyPath}`);
  console.log(`  Key type: ${keyType}`);
  process.env.GIT_SSH_COMMAND = `ssh -i ~/.ssh/${selectedKey} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
  console.log(`  GIT_SSH_COMMAND set to: ${process.env.GIT_SSH_COMMAND}`);
};

const cloneRepository = async (
  workspaceHome: string,
  runtimeConfig: RuntimeConfig | null,
  repoUrl: string,
  repoBranch: string,
  markerPath: string,
  runtimeConfigPath: string,
) => {
  if (!repoUrl) {
    console.log("No repository URL configured. Skipping clone.");
    return;
  }
  if (await pathExists(markerPath)) {
    console.log("Workspace already initialized. Skipping repository clone.");
    return;
  }

  const repoName = repoUrl.replace(/\/+$/, "").split("/").pop() ?? "repo";
  const cleanRepoName = repoName.replace(/\.git$/, "");
  const repoPath = path.join(workspaceHome, cleanRepoName);
  if (await pathExists(repoPath)) {
    console.log(`Repository directory '${cleanRepoName}' already exists. Skipping clone.`);
    await configureGitSshKey(workspaceHome, repoPath, runtimeConfig?.ssh?.selectedKey ?? "");
    return;
  }

  console.log("=== Configuration Debug Info ===");
  console.log(`Repository URL: ${repoUrl}`);
  await logRuntimeConfigContents(runtimeConfigPath);

  const cloneArgs = resolveCloneArgs(runtimeConfig);
  const selectedKey = runtimeConfig?.ssh?.selectedKey ?? "";

  console.log("--- SSH Key Selection ---");
  console.log(`  ssh.selectedKey: ${selectedKey || "null"}`);
  await logSelectedKey(workspaceHome, selectedKey);
  console.log("=== End Configuration Debug Info ===");
  console.log("");

  await ensureKnownHost(workspaceHome, repoUrl);
  const branchArgs = ["clone", ...cloneArgs, "--branch", repoBranch, repoUrl];
  const baseArgs = ["clone", ...cloneArgs, repoUrl];
  const hasBranchArg = cloneArgs.some((arg) => arg === "--branch" || arg === "-b" || arg.startsWith("--branch="));

  let lastError: CommandError | null = null;
  const attemptClone = async (args: string[], label: string): Promise<boolean> => {
    console.log(`Attempting ${label}...`);
    try {
      await runCommand("git", args, { cwd: workspaceHome, env: { ...process.env } });
      console.log(`${label} succeeded.`);
      return true;
    } catch (error) {
      if (error instanceof CommandError) {
        lastError = error;
        console.log(`${label} failed with exit code ${error.code}.`);
        if (error.stderr.trim()) {
          console.log(error.stderr.trim());
        }
        return false;
      }
      throw error;
    }
  };

  let cloneSucceeded = false;
  if (!hasBranchArg) {
    const label = `git clone --branch ${repoBranch}`;
    cloneSucceeded = await attemptClone(branchArgs, label);
    if (!cloneSucceeded) {
      console.log("Retrying clone without explicit branch flag...");
    }
  }

  if (!cloneSucceeded) {
    cloneSucceeded = await attemptClone(baseArgs, "git clone");
  }

  if (!cloneSucceeded) {
    console.log("Failed to clone repository. Ensure your SSH agent is forwarded or use HTTPS URL.");
    if (lastError) {
      throw lastError;
    }
    throw new Error("Failed to clone repository.");
  }
  console.log("Repository clone completed.");

  if (await pathExists(repoPath)) {
    await configureGitSshKey(workspaceHome, repoPath, selectedKey);
  }
};

export const runInit = async () => {
  const workspaceHome = process.env.WORKSPACE_HOME ?? "/home/workspace";
  const hostHome = process.env.HOST_HOME ?? "/host/home";
  const runtimeConfigPath = process.env.WORKSPACE_RUNTIME_CONFIG ?? "/workspace/config/runtime.json";
  const repoUrl = process.env.WORKSPACE_REPO_URL ?? process.env.GIT_REPO ?? "";
  const repoBranch = process.env.WORKSPACE_REPO_BRANCH ?? process.env.BRANCH ?? "main";
  const markerPath = path.join(workspaceHome, ".workspace-initialized");

  if (await pathExists("/ssh-agent")) {
    process.env.SSH_AUTH_SOCK = "/ssh-agent";
  }

  await copyGitConfig(workspaceHome, hostHome);
  const runtimeConfig = await loadRuntimeConfig(runtimeConfigPath);
  await cloneRepository(workspaceHome, runtimeConfig, repoUrl, repoBranch, markerPath, runtimeConfigPath);
  await configureShellHelpers(workspaceHome);
  await installLazyVim(workspaceHome, hostHome, markerPath);
  await installDevTools(markerPath);
  const entries = runtimeConfig ? buildBootstrapEntries(runtimeConfig) : [];
  await runBootstrapScripts(workspaceHome, entries);
  await fs.writeFile(markerPath, "", "utf8");
  console.log("Workspace initialization complete.");
};
