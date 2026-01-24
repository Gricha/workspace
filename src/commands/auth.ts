import crypto from 'crypto';
import { loadAgentConfig, saveAgentConfig, getConfigDir } from '../config/loader';

export async function authInit(): Promise<void> {
  const configDir = getConfigDir();
  const config = await loadAgentConfig(configDir);

  if (config.auth?.token) {
    console.log('Auth token already exists.');
    console.log('To regenerate, remove auth.token from config.json first.');
    return;
  }

  const token = crypto.randomBytes(12).toString('hex');
  config.auth = { ...config.auth, token };
  await saveAgentConfig(config, configDir);

  console.log(`Auth token generated: ${token}`);
  console.log(`Configure clients with: perry config token ${token}`);
  console.log('Restart the agent for auth to take effect.');
}
