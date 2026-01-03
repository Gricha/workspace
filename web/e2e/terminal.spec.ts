import { test, expect, type Page } from '@playwright/test'

const E2E_WORKSPACE = 'e2e-test'

async function ensureWorkspaceRunning(page: Page): Promise<boolean> {
  await page.goto('/workspaces')

  let workspaceCard = page.locator(`[data-testid="workspace-card"]:has-text("${E2E_WORKSPACE}")`)

  if ((await workspaceCard.count()) === 0) {
    const createButton = page.getByRole('button', { name: /create/i })
    await createButton.click()

    const nameInput = page.getByPlaceholder(/name/i)
    await nameInput.fill(E2E_WORKSPACE)

    const submitButton = page.getByRole('button', { name: /create/i }).last()
    await submitButton.click()

    await page.waitForTimeout(5000)
    await page.goto('/workspaces')

    workspaceCard = page.locator(`[data-testid="workspace-card"]:has-text("${E2E_WORKSPACE}")`)
    await expect(workspaceCard).toBeVisible({ timeout: 30000 })
  }

  await workspaceCard.click()

  const statusBadge = page.locator('[data-testid="workspace-status"]')
  const status = await statusBadge.textContent()

  if (status?.toLowerCase() !== 'running') {
    const startButton = page.getByRole('button', { name: /start/i })
    if (await startButton.isVisible()) {
      await startButton.click()
      await page.waitForTimeout(10000)
      await page.reload()
    }
  }

  const terminalButton = page.getByRole('button', { name: /terminal/i })
  const isRunning = await terminalButton.isVisible().catch(() => false)

  return isRunning
}

test.describe('Terminal Integration', () => {
  test('workspace list loads and shows workspaces', async ({ page }) => {
    await page.goto('/workspaces')
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
  })

  test('terminal connects and receives output', async ({ page }) => {
    const isRunning = await ensureWorkspaceRunning(page)
    if (!isRunning) {
      test.skip(true, 'Could not start workspace')
      return
    }

    const terminalButton = page.getByRole('button', { name: /terminal/i })
    await terminalButton.click()

    const terminalScreen = page.locator('.xterm-screen')
    await expect(terminalScreen).toBeVisible({ timeout: 15000 })

    await page.waitForTimeout(2000)

    const initialText = await terminalScreen.textContent()
    expect(initialText).toContain('Connected')

    await terminalScreen.click()
    await page.keyboard.type('echo "PLAYWRIGHT_TEST_123"', { delay: 50 })
    await page.keyboard.press('Enter')

    await page.waitForTimeout(2000)

    const outputText = await terminalScreen.textContent()
    expect(outputText).toContain('PLAYWRIGHT_TEST_123')
  })

  test('terminal handles multiple commands', async ({ page }) => {
    const isRunning = await ensureWorkspaceRunning(page)
    if (!isRunning) {
      test.skip(true, 'Could not start workspace')
      return
    }

    const terminalButton = page.getByRole('button', { name: /terminal/i })
    await terminalButton.click()

    const terminalScreen = page.locator('.xterm-screen')
    await expect(terminalScreen).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(2000)

    await terminalScreen.click()

    await page.keyboard.type('pwd', { delay: 50 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    await page.keyboard.type('ls -la', { delay: 50 })
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    const outputText = await terminalScreen.textContent()
    expect(outputText).toMatch(/workspace|home/)
  })
})

test.describe('Sessions and Chat Integration', () => {
  test('sessions page loads', async ({ page }) => {
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

  test('workspace sessions page shows new chat button', async ({ page }) => {
    const isRunning = await ensureWorkspaceRunning(page)
    if (!isRunning) {
      test.skip(true, 'Could not start workspace')
      return
    }

    const sessionsButton = page.getByRole('button', { name: /sessions/i })
    await sessionsButton.click()

    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()

    const newChatButton = page.getByRole('button', { name: /new chat/i })
    await expect(newChatButton).toBeVisible()
  })

  test('new chat opens chat interface', async ({ page }) => {
    const isRunning = await ensureWorkspaceRunning(page)
    if (!isRunning) {
      test.skip(true, 'Could not start workspace')
      return
    }

    const sessionsButton = page.getByRole('button', { name: /sessions/i })
    await sessionsButton.click()

    const newChatButton = page.getByRole('button', { name: /new chat/i })
    await newChatButton.click()

    const claudeCodeOption = page.getByRole('menuitem', { name: /claude code/i })
    await claudeCodeOption.click()

    await expect(page.getByText('Claude Code')).toBeVisible()

    const connectedIndicator = page.getByText(/connected/i)
    await expect(connectedIndicator).toBeVisible({ timeout: 10000 })

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
  })

  test('chat can send message and receive response', async ({ page }) => {
    test.setTimeout(120000)

    const isRunning = await ensureWorkspaceRunning(page)
    if (!isRunning) {
      test.skip(true, 'Could not start workspace')
      return
    }

    const sessionsButton = page.getByRole('button', { name: /sessions/i })
    await sessionsButton.click()

    const newChatButton = page.getByRole('button', { name: /new chat/i })
    await newChatButton.click()

    const claudeCodeOption = page.getByRole('menuitem', { name: /claude code/i })
    await claudeCodeOption.click()

    const connectedIndicator = page.getByText(/connected/i)
    await expect(connectedIndicator).toBeVisible({ timeout: 10000 })

    const textarea = page.locator('textarea')
    await textarea.fill('Say exactly: TEST_RESPONSE_OK')

    const sendButton = page.locator('button:has(svg)').last()
    await sendButton.click()

    const response = page.locator('.prose')
    await expect(response.first()).toBeVisible({ timeout: 60000 })

    await page.waitForTimeout(5000)

    const responseText = await page.locator('.prose').allTextContents()
    expect(responseText.join('')).toContain('TEST_RESPONSE_OK')
  })
})
