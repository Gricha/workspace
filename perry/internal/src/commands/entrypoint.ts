import { addSshKeys } from "./add-ssh-key";
import { syncUserWithHost } from "./sync-user";
import { ensureDockerd, monitorServices, startSshd, tailDockerdLogs, waitForDocker } from "../lib/services";
import { runCommand } from "../lib/process";
import { writeEnvironmentFile } from "../lib/environment";

export const runEntrypoint = async () => {
  console.log("[entrypoint] Syncing user with host...");
  await syncUserWithHost();
  console.log("[entrypoint] Adding SSH key...");
  try {
    await addSshKeys();
  } catch (error) {
    console.log(`[entrypoint] Failed to add SSH key (non-fatal): ${(error as Error).message}`);
  }
  console.log("[entrypoint] Starting Docker daemon...");
  ensureDockerd();
  const ready = await waitForDocker();
  if (!ready) {
    process.exit(1);
    return;
  }
  console.log("[entrypoint] Running workspace initialization as workspace user...");
  try {
    await runCommand("sudo", ["-u", "workspace", "-E", "/usr/local/bin/workspace-internal", "init"], {
      env: process.env,
    });
  } catch (error) {
    console.log(`[entrypoint] Initialization failed (non-fatal): ${(error as Error).message}`);
    console.log("[entrypoint] SSH will still start - connect to debug the issue");
  }
  console.log("[entrypoint] Writing environment file...");
  try {
    await writeEnvironmentFile(process.env as Record<string, string>);
  } catch (error) {
    console.log(`[entrypoint] Failed to write environment file (non-fatal): ${(error as Error).message}`);
  }
  console.log("[entrypoint] Starting SSH daemon...");
  await startSshd();
  void monitorServices();
  await tailDockerdLogs();
};
