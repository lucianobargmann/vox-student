import { test, expect } from '@playwright/test';

test.describe('Admin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated super_admin state
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'valid-admin-token');
    });

    // Mock the auth/me API for super_admin
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-user-id',
            email: 'admin@voxstudent.com',
            profile: {
              id: 'admin-profile-id',
              fullName: 'Super Admin',
              role: 'super_admin'
            }
          }
        })
      });
    });

    // Mock API endpoints that the admin pages might call
    await page.route('/api/reminder-templates', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    await page.route('/api/security/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          data: {
            summary: {
              totalSecurityEvents: 0,
              totalAuditLogs: 0,
              failedLoginAttempts: 0,
              activeUsers: 0
            },
            statistics: {
              eventsByType: {},
              eventsBySeverity: {},
              actionsByType: {}
            },
            recentEvents: [],
            recentAuditLogs: [],
            failedLogins: []
          }
        })
      });
    });

    await page.route('/api/students', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    await page.route('/api/courses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    await page.route('/api/classes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    await page.route('/api/whatsapp/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          data: {
            whatsappEnabled: false,
            whatsappApiKey: '',
            whatsappPhoneNumber: '',
            whatsappRateLimitSeconds: 30
          }
        })
      });
    });
  });

  test('should display admin dashboard for super_admin', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load and check for admin dashboard
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    await expect(page.locator('text=Super Admin')).toBeVisible();
    
    // Take screenshot of dashboard
    await page.screenshot({ 
      path: 'test-results/admin-dashboard.png',
      fullPage: true 
    });
  });

  test('should navigate to Templates de Lembrete page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Click Templates de Lembrete button
    await page.click('button:has-text("Templates de Lembrete")');
    
    // Should navigate to reminder templates page
    await expect(page).toHaveURL('/admin/reminder-templates');
    
    // Check if the page loaded correctly
    await expect(page.getByRole('heading', { name: 'Templates de Lembrete' })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/reminder-templates-page.png',
      fullPage: true 
    });
  });

  test('should navigate to Relatórios page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Click Relatórios button
    await page.click('button:has-text("Relatórios")');
    
    // Should navigate to reports page
    await expect(page).toHaveURL('/admin/reports');
    
    // Check if the page loaded correctly - use more specific selector
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/reports-page.png',
      fullPage: true 
    });
  });

  test('should navigate to Configurações page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Click Configurações button
    await page.click('button:has-text("Configurações")');
    
    // Should navigate to settings page
    await expect(page).toHaveURL('/admin/settings');
    
    // Check if the page loaded correctly - use more specific selector
    await expect(page.getByRole('heading', { name: 'Configurações do Sistema' })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/settings-page.png',
      fullPage: true 
    });
  });

  test('should navigate to Dashboard de Segurança page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Click Dashboard de Segurança button
    await page.click('button:has-text("Dashboard de Segurança")');
    
    // Should navigate to security dashboard page
    await expect(page).toHaveURL('/admin/security');
    
    // Check if the page loaded correctly
    await expect(page.getByRole('heading', { name: 'Dashboard de Segurança' })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/security-dashboard-page.png',
      fullPage: true 
    });
  });

  test('should navigate to Painel do WhatsApp page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Click Painel do WhatsApp button
    await page.click('button:has-text("Painel do WhatsApp")');
    
    // Should navigate to whatsapp panel page
    await expect(page).toHaveURL('/admin/whatsapp');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/whatsapp-panel-page.png',
      fullPage: true 
    });
  });

  test('should test all admin navigation buttons in sequence', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Painel Administrativo')).toBeVisible();
    
    // Take initial dashboard screenshot
    await page.screenshot({ 
      path: 'test-results/00-initial-dashboard.png',
      fullPage: true 
    });

    const adminButtons = [
      { text: 'Cursos', url: '/admin/courses', expectedHeading: 'Gerenciar Cursos' },
      { text: 'Turmas', url: '/admin/classes', expectedHeading: 'Gerenciar Turmas' },
      { text: 'Alunos', url: '/admin/students', expectedHeading: 'Gerenciar Alunos' },
      { text: 'Templates de Lembrete', url: '/admin/reminder-templates', expectedHeading: 'Templates de Lembrete' },
      { text: 'Controle de Presença', url: '/admin/attendance', expectedHeading: 'Controle de Presença' },
      { text: 'Relatórios', url: '/admin/reports', expectedHeading: 'Relatórios' },
      { text: 'Configurações', url: '/admin/settings', expectedHeading: 'Configurações do Sistema' },
      { text: 'Painel do WhatsApp', url: '/admin/whatsapp', expectedHeading: 'Painel do WhatsApp' },
      { text: 'Dashboard de Segurança', url: '/admin/security', expectedHeading: 'Dashboard de Segurança' }
    ];

    for (let i = 0; i < adminButtons.length; i++) {
      const button = adminButtons[i];
      
      console.log(`Testing button: ${button.text}`);
      
      // Go back to dashboard
      await page.goto('/');
      await expect(page.locator('text=Painel Administrativo')).toBeVisible();
      
      // Click the button
      await page.click(`button:has-text("${button.text}")`);
      
      // Verify URL
      await expect(page).toHaveURL(button.url);
      
      // If expected heading is provided, check for it
      if (button.expectedHeading) {
        await expect(page.getByRole('heading', { name: button.expectedHeading })).toBeVisible({ timeout: 10000 });
      }
      
      // Take screenshot with numbered filename
      const filename = `test-results/${String(i + 1).padStart(2, '0')}-${button.text.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      await page.screenshot({ 
        path: filename,
        fullPage: true 
      });
      
      console.log(`✓ Button "${button.text}" works - navigated to ${button.url}`);
    }
  });
});