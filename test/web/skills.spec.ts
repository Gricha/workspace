import { test, expect } from './fixtures';
import { generateTestWorkspaceName } from '../helpers/agent';

test.describe('Web UI - Skills', () => {
  test('skills page loads from sidebar', async ({ agent, page }) => {
    // Create a workspace first to bypass setup guard
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/`);

      await page.getByRole('link', { name: 'Skills' }).click();
      await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Add Skill' })).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});
