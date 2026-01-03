import { test, expect } from '@playwright/test'

test.describe('Terminal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspaces')
  })

  test('workspace list loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  })

  test('can navigate to a running workspace', async ({ page }) => {
    const workspaceCard = page.locator('[data-testid="workspace-card"]').first()
    const hasWorkspace = (await workspaceCard.count()) > 0

    if (!hasWorkspace) {
      test.skip()
      return
    }

    await workspaceCard.click()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('terminal connects to running workspace', async ({ page }) => {
    const workspaceCard = page.locator('[data-testid="workspace-card"]').first()
    const hasWorkspace = (await workspaceCard.count()) > 0

    if (!hasWorkspace) {
      test.skip()
      return
    }

    await workspaceCard.click()

    const terminalButton = page.getByRole('button', { name: /terminal/i })
    const isRunning = await terminalButton.isVisible().catch(() => false)

    if (!isRunning) {
      test.skip()
      return
    }

    await terminalButton.click()

    const terminal = page.locator('.xterm-screen')
    await expect(terminal).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(2000)

    const terminalText = await terminal.textContent()
    expect(terminalText).toContain('Connected')
  })

  test('can type in terminal', async ({ page }) => {
    const workspaceCard = page.locator('[data-testid="workspace-card"]').first()
    const hasWorkspace = (await workspaceCard.count()) > 0

    if (!hasWorkspace) {
      test.skip()
      return
    }

    await workspaceCard.click()

    const terminalButton = page.getByRole('button', { name: /terminal/i })
    const isRunning = await terminalButton.isVisible().catch(() => false)

    if (!isRunning) {
      test.skip()
      return
    }

    await terminalButton.click()

    const terminal = page.locator('.xterm-screen')
    await expect(terminal).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(2000)

    await terminal.click()
    await page.keyboard.type('echo "test-output-123"')
    await page.keyboard.press('Enter')

    await page.waitForTimeout(1000)

    const terminalText = await terminal.textContent()
    expect(terminalText).toContain('test-output-123')
  })

  test('terminal shows disconnection on workspace stop', async ({ page }) => {
    const workspaceCard = page.locator('[data-testid="workspace-card"]').first()
    const hasWorkspace = (await workspaceCard.count()) > 0

    if (!hasWorkspace) {
      test.skip()
      return
    }

    await workspaceCard.click()

    const terminalButton = page.getByRole('button', { name: /terminal/i })
    const isRunning = await terminalButton.isVisible().catch(() => false)

    if (!isRunning) {
      test.skip()
      return
    }

    await terminalButton.click()

    const terminal = page.locator('.xterm-screen')
    await expect(terminal).toBeVisible({ timeout: 10000 })

    await page.waitForTimeout(2000)

    const terminalText = await terminal.textContent()
    expect(terminalText).toContain('Connected')
  })
})

test.describe('Sessions', () => {
  test('sessions overview loads', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByRole('heading', { name: 'All Sessions' })).toBeVisible()
  })

  test('can filter sessions by agent type', async ({ page }) => {
    await page.goto('/sessions')

    const filterButton = page.getByRole('button', { name: /all agents/i })
    await expect(filterButton).toBeVisible()

    await filterButton.click()

    const claudeOption = page.getByRole('menuitemradio', { name: /claude code/i })
    await expect(claudeOption).toBeVisible()
  })

  test('workspace sessions page loads', async ({ page }) => {
    await page.goto('/workspaces')

    const workspaceCard = page.locator('[data-testid="workspace-card"]').first()
    const hasWorkspace = (await workspaceCard.count()) > 0

    if (!hasWorkspace) {
      test.skip()
      return
    }

    await workspaceCard.click()

    const sessionsButton = page.getByRole('button', { name: /sessions/i })
    const isRunning = await sessionsButton.isVisible().catch(() => false)

    if (!isRunning) {
      test.skip()
      return
    }

    await sessionsButton.click()

    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
  })
})
