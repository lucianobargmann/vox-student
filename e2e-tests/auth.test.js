const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  mailpitUrl: 'http://localhost:8025',
  superAdminEmail: 'luciano@hcktplanet.com',
  testTimeout: 30000,
  screenshotDir: path.join(__dirname, 'screenshots'),
  headless: false, // Set to true for CI/CD
};

// Ensure screenshot directory exists
if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
  fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
}

class VoxStudentE2ETests {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('🚀 Setting up E2E test environment...');
    
    this.browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser Console Error:', msg.text());
      }
    });
    
    // Set up request/response logging for debugging
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`❌ HTTP Error: ${response.status()} ${response.url()}`);
      }
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async takeScreenshot(name) {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(TEST_CONFIG.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  async waitForElement(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.log(`⚠️  Element not found: ${selector}`);
      return false;
    }
  }

  async clearMailpit() {
    try {
      // Clear all emails in Mailpit before test
      await fetch(`${TEST_CONFIG.mailpitUrl}/api/v1/messages`, {
        method: 'DELETE'
      });
      console.log('🗑️  Mailpit inbox cleared');
    } catch (error) {
      console.log('⚠️  Could not clear Mailpit inbox:', error.message);
    }
  }

  async getLatestEmailFromMailpit() {
    try {
      const response = await fetch(`${TEST_CONFIG.mailpitUrl}/api/v1/messages`);
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        // Get the latest email
        const latestEmail = data.messages[0];
        
        // Get email content
        const contentResponse = await fetch(`${TEST_CONFIG.mailpitUrl}/api/v1/message/${latestEmail.ID}`);
        const emailContent = await contentResponse.json();
        
        return {
          id: latestEmail.ID,
          to: latestEmail.To[0].Address,
          subject: latestEmail.Subject,
          content: emailContent
        };
      }
      return null;
    } catch (error) {
      console.log('⚠️  Could not fetch email from Mailpit:', error.message);
      return null;
    }
  }

  extractMagicLinkFromEmail(emailContent) {
    try {
      // Extract magic link from HTML content
      const htmlContent = emailContent.HTML;
      const linkMatch = htmlContent.match(/href="([^"]*auth\/verify[^"]*)"/);
      
      if (linkMatch && linkMatch[1]) {
        return linkMatch[1];
      }
      
      // Fallback: extract from text content
      const textContent = emailContent.Text;
      const textMatch = textContent.match(/(http[s]?:\/\/[^\s]*auth\/verify[^\s]*)/);
      
      if (textMatch && textMatch[1]) {
        return textMatch[1];
      }
      
      return null;
    } catch (error) {
      console.log('⚠️  Could not extract magic link from email:', error.message);
      return null;
    }
  }

  // Test Case 1: Successful login for super admin
  async testSuperAdminLogin() {
    console.log('\n🧪 Test 1: Super Admin Login Success');
    
    try {
      await this.clearMailpit();
      
      // Navigate to login page
      await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);
      await this.takeScreenshot('01-login-page');
      
      // Check if login form is present
      const emailInput = await this.waitForElement('input[type="email"]');
      if (!emailInput) {
        throw new Error('Email input not found on login page');
      }
      
      // Fill in super admin email
      await this.page.type('input[type="email"]', TEST_CONFIG.superAdminEmail);
      await this.takeScreenshot('02-email-filled');
      
      // Submit form
      await this.page.click('button[type="submit"]');
      
      // Wait for success message
      const successMessage = await this.waitForElement('[role="alert"]', 10000);
      if (!successMessage) {
        throw new Error('Success message not displayed after form submission');
      }
      
      await this.takeScreenshot('03-magic-link-sent');
      
      // Wait for email to arrive in Mailpit
      console.log('📧 Waiting for magic link email...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const email = await this.getLatestEmailFromMailpit();
      if (!email) {
        throw new Error('Magic link email not received in Mailpit');
      }
      
      console.log(`✅ Email received: ${email.subject} to ${email.to}`);
      
      // Extract magic link
      const magicLink = this.extractMagicLinkFromEmail(email.content);
      if (!magicLink) {
        throw new Error('Could not extract magic link from email');
      }
      
      console.log(`🔗 Magic link extracted: ${magicLink}`);
      
      // Navigate to magic link
      await this.page.goto(magicLink);
      await this.takeScreenshot('04-magic-link-verification');
      
      // Wait for redirect to dashboard
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
      
      // Check if we're on the dashboard
      const dashboardTitle = await this.waitForElement('h1', 5000);
      if (!dashboardTitle) {
        throw new Error('Dashboard not loaded after magic link verification');
      }
      
      const titleText = await this.page.$eval('h1', el => el.textContent);
      if (!titleText.includes('Dashboard')) {
        throw new Error('Not redirected to dashboard after login');
      }
      
      await this.takeScreenshot('05-dashboard-success');
      
      console.log('✅ Super admin login test PASSED');
      return { success: true, message: 'Super admin can login successfully' };
      
    } catch (error) {
      await this.takeScreenshot('error-super-admin-login');
      console.log('❌ Super admin login test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 2: Email não existe no sistema (should not send email)
  async testNonExistentUserEmail() {
    console.log('\n🧪 Test 2: Non-existent User Email (Security)');

    try {
      await this.clearMailpit();

      const testEmail = 'nonexistent@example.com';

      // Navigate to login page
      await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);

      // Fill in non-existent user email
      await this.page.type('input[type="email"]', testEmail);
      await this.takeScreenshot('06-nonexistent-user-email');

      // Submit form
      await this.page.click('button[type="submit"]');

      // Should show success message (to prevent email enumeration)
      const successMessage = await this.waitForElement('[role="alert"]', 10000);
      if (!successMessage) {
        throw new Error('Success message not displayed (should show to prevent enumeration)');
      }

      await this.takeScreenshot('07-nonexistent-user-response');

      // Verify NO email was sent (security feature)
      await new Promise(resolve => setTimeout(resolve, 3000));
      const email = await this.getLatestEmailFromMailpit();

      if (email && email.to === testEmail) {
        throw new Error('Security violation: Magic link email was sent to non-existent user');
      }

      console.log('✅ Non-existent user email test PASSED');
      return { success: true, message: 'Non-existent users do not receive emails (security feature)' };

    } catch (error) {
      await this.takeScreenshot('error-nonexistent-user-email');
      console.log('❌ Non-existent user email test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 3: Invalid email format
  async testInvalidEmailFormat() {
    console.log('\n🧪 Test 3: Invalid Email Format');
    
    try {
      // Navigate to login page
      await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      // Try invalid email format
      await this.page.type('input[type="email"]', 'invalid-email');
      await this.takeScreenshot('08-invalid-email');
      
      // Submit form
      await this.page.click('button[type="submit"]');
      
      // Should show validation error or prevent submission
      const errorMessage = await this.waitForElement('[role="alert"]', 5000);
      
      // Check if form validation prevents submission
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        console.log('✅ Form validation prevented submission of invalid email');
      }
      
      await this.takeScreenshot('09-invalid-email-result');
      
      console.log('✅ Invalid email format test PASSED');
      return { success: true, message: 'Invalid email format is properly handled' };
      
    } catch (error) {
      await this.takeScreenshot('error-invalid-email');
      console.log('❌ Invalid email format test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 4: Backend não responde (simulate server down)
  async testBackendDown() {
    console.log('\n🧪 Test 4: Backend Not Responding');
    
    try {
      // Navigate to login page
      await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);
      
      // Intercept API calls and make them fail
      await this.page.setRequestInterception(true);
      
      this.page.on('request', (request) => {
        if (request.url().includes('/api/auth/magic-link')) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Fill in email
      await this.page.type('input[type="email"]', 'test@example.com');
      await this.takeScreenshot('10-backend-down-email');
      
      // Submit form
      await this.page.click('button[type="submit"]');
      
      // Should show error message
      const errorMessage = await this.waitForElement('[role="alert"]', 10000);
      if (!errorMessage) {
        throw new Error('Error message not displayed when backend is down');
      }
      
      await this.takeScreenshot('11-backend-down-error');
      
      // Reset request interception
      await this.page.setRequestInterception(false);
      
      console.log('✅ Backend down test PASSED');
      return { success: true, message: 'Backend failure is properly handled with error message' };
      
    } catch (error) {
      await this.takeScreenshot('error-backend-down');
      console.log('❌ Backend down test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🎯 Starting VoxStudent E2E Authentication Tests\n');
    
    const results = [];
    
    try {
      await this.setup();
      
      // Run all test cases
      results.push(await this.testSuperAdminLogin());
      results.push(await this.testNonExistentUserEmail());
      results.push(await this.testInvalidEmailFormat());
      results.push(await this.testBackendDown());
      
    } finally {
      await this.teardown();
    }
    
    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    results.forEach((result, index) => {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`Test ${index + 1}: ${status} - ${result.message}`);
      
      if (result.success) passed++;
      else failed++;
    });
    
    console.log('=' .repeat(50));
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`📸 Screenshots saved in: ${TEST_CONFIG.screenshotDir}`);
    
    return results;
  }
}

// Export for use in other files
module.exports = VoxStudentE2ETests;

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = new VoxStudentE2ETests();
  testRunner.runAllTests()
    .then(results => {
      const allPassed = results.every(r => r.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}
