import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page for unauthenticated users', async ({ page }) => {
    await page.goto('/admin/courses');
    
    // Should redirect to login or show login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Enviar Link Mágico")')).toBeVisible();
  });

  test('should send magic link', async ({ page }) => {
    let magicLinkRequested = false;
    let requestedEmail = '';

    // Mock the magic link API
    await page.route('/api/auth/magic-link', async (route) => {
      const requestBody = await route.request().postDataJSON();
      magicLinkRequested = true;
      requestedEmail = requestBody.email;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Link enviado com sucesso!' })
      });
    });

    await page.goto('/login');
    
    // Fill email and request magic link
    await page.fill('input[type="email"]', 'luciano@hcktplanet.com');
    await page.click('button:has-text("Enviar Link Mágico")');
    
    // Verify magic link was requested
    expect(magicLinkRequested).toBe(true);
    expect(requestedEmail).toBe('luciano@hcktplanet.com');
    
    // Should show success message
    await expect(page.locator('text=Link enviado com sucesso!')).toBeVisible();
  });

  test('should handle invalid email', async ({ page }) => {
    // Mock the magic link API to return error
    await page.route('/api/auth/magic-link', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Email inválido' })
      });
    });

    await page.goto('/login');
    
    // Fill invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.click('button:has-text("Enviar Link Mágico")');
    
    // Should show error message
    await expect(page.locator('text=Email inválido')).toBeVisible();
  });

  test('should verify magic link token', async ({ page }) => {
    let tokenVerified = false;
    let verifiedToken = '';

    // Mock the verify API
    await page.route('/api/auth/verify', async (route) => {
      const requestBody = await route.request().postDataJSON();
      tokenVerified = true;
      verifiedToken = requestBody.token;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          token: 'jwt-token-here',
          user: {
            id: 'user-id',
            email: 'luciano@hcktplanet.com',
            profile: {
              id: 'profile-id',
              fullName: 'Luciano Bargmann',
              role: 'super_admin'
            }
          }
        })
      });
    });

    // Mock the /api/auth/me endpoint for after login
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-id',
          email: 'luciano@hcktplanet.com',
          profile: {
            id: 'profile-id',
            fullName: 'Luciano Bargmann',
            role: 'super_admin'
          }
        })
      });
    });

    await page.goto('/auth/verify?token=valid-magic-token');
    
    // Verify token was processed
    expect(tokenVerified).toBe(true);
    expect(verifiedToken).toBe('valid-magic-token');
    
    // Should redirect to home page after successful verification
    await expect(page).toHaveURL('/');
  });

  test('should handle invalid magic link token', async ({ page }) => {
    // Mock the verify API to return error
    await page.route('/api/auth/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Link inválido ou expirado' })
      });
    });

    await page.goto('/auth/verify?token=invalid-token');
    
    // Should show error message
    await expect(page.locator('text=Link inválido ou expirado')).toBeVisible();
  });

  test('should logout user', async ({ page }) => {
    let logoutRequested = false;

    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'valid-token');
    });

    // Mock the auth/me API
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-id',
          email: 'luciano@hcktplanet.com',
          profile: {
            id: 'profile-id',
            fullName: 'Luciano Bargmann',
            role: 'super_admin'
          }
        })
      });
    });

    // Mock the logout API
    await page.route('/api/auth/logout', async (route) => {
      logoutRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Logout realizado com sucesso' })
      });
    });

    await page.goto('/');
    
    // Should show user info and logout button
    await expect(page.locator('text=luciano@hcktplanet.com')).toBeVisible();
    
    // Click logout
    await page.click('button:has-text("Sair")');
    
    // Verify logout was requested
    expect(logoutRequested).toBe(true);
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should restrict access to admin pages', async ({ page }) => {
    // Mock unauthenticated state
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token não fornecido' })
      });
    });

    await page.goto('/admin/courses');
    
    // Should redirect to home or show login
    await expect(page).toHaveURL('/');
  });

  test('should restrict access based on user role', async ({ page }) => {
    // Mock user with regular role (not admin)
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'valid-token');
    });

    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-id',
          email: 'user@example.com',
          profile: {
            id: 'profile-id',
            fullName: 'Regular User',
            role: 'user'
          }
        })
      });
    });

    await page.goto('/admin/courses');
    
    // Should redirect to home since user is not admin
    await expect(page).toHaveURL('/');
  });
});
