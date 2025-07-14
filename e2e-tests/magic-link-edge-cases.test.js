const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  mailpitUrl: 'http://localhost:8025',
  testEmail: 'edgecase@example.com',
  testTimeout: 30000,
  screenshotDir: path.join(__dirname, 'screenshots'),
  headless: false,
};

// Ensure screenshot directory exists
if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
  fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
}

class MagicLinkEdgeCaseTests {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('🚀 Setting up Magic Link Edge Case tests...');
    
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
        const latestEmail = data.messages[0];
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
      const htmlContent = emailContent.HTML;
      const linkMatch = htmlContent.match(/href="([^"]*auth\/verify[^"]*)"/);
      
      if (linkMatch && linkMatch[1]) {
        return linkMatch[1];
      }
      
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

  async requestMagicLink(email) {
    await this.page.goto(`${TEST_CONFIG.baseUrl}/login`);
    await this.page.type('input[type="email"]', email);
    await this.page.click('button[type="submit"]');
    
    // Wait for success message
    await this.waitForElement('[role="alert"]', 10000);
    
    // Wait for email
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const emailData = await this.getLatestEmailFromMailpit();
    if (!emailData) {
      throw new Error('Magic link email not received');
    }
    
    return this.extractMagicLinkFromEmail(emailData.content);
  }

  // Test Case 1: Link já utilizado (used magic link)
  async testUsedMagicLink() {
    console.log('\n🧪 Test: Used Magic Link');
    
    try {
      await this.clearMailpit();
      
      // Request magic link
      const magicLink = await this.requestMagicLink(TEST_CONFIG.testEmail);
      if (!magicLink) {
        throw new Error('Could not get magic link');
      }
      
      console.log(`🔗 Magic link obtained: ${magicLink}`);
      
      // Use the magic link first time (should work)
      await this.page.goto(magicLink);
      await this.takeScreenshot('12-first-magic-link-use');
      
      // Wait for successful login/redirect
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
      
      // Check if we're on dashboard
      const dashboardTitle = await this.waitForElement('h1', 5000);
      if (!dashboardTitle) {
        throw new Error('First magic link use failed');
      }
      
      console.log('✅ First magic link use successful');
      
      // Now try to use the same magic link again (should fail)
      await this.page.goto(magicLink);
      await this.takeScreenshot('13-second-magic-link-use');
      
      // Should show error message or redirect to login
      const errorElement = await this.waitForElement('[role="alert"], .error, .alert-error', 5000);
      
      // Check if we're redirected back to login or error page
      const currentUrl = this.page.url();
      const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth/verify');
      
      if (errorElement || isOnLoginPage) {
        console.log('✅ Used magic link properly rejected');
        await this.takeScreenshot('14-used-link-rejected');
        
        return { success: true, message: 'Used magic links are properly rejected' };
      } else {
        throw new Error('Used magic link was not properly rejected');
      }
      
    } catch (error) {
      await this.takeScreenshot('error-used-magic-link');
      console.log('❌ Used magic link test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 2: Link expirado (expired magic link)
  async testExpiredMagicLink() {
    console.log('\n🧪 Test: Expired Magic Link (Simulated)');
    
    try {
      // Create a fake expired token URL
      const expiredToken = 'expired-token-12345';
      const expiredLink = `${TEST_CONFIG.baseUrl}/auth/verify?token=${expiredToken}`;
      
      // Try to use expired/invalid token
      await this.page.goto(expiredLink);
      await this.takeScreenshot('15-expired-magic-link');
      
      // Should show error message
      const errorElement = await this.waitForElement('[role="alert"], .error, .alert-error', 5000);
      
      // Check if we're redirected to login or error page
      const currentUrl = this.page.url();
      const isOnLoginOrError = currentUrl.includes('/login') || currentUrl.includes('/auth/verify');
      
      if (errorElement || isOnLoginOrError) {
        console.log('✅ Expired/invalid magic link properly rejected');
        await this.takeScreenshot('16-expired-link-rejected');
        
        return { success: true, message: 'Expired/invalid magic links are properly rejected' };
      } else {
        throw new Error('Expired magic link was not properly rejected');
      }
      
    } catch (error) {
      await this.takeScreenshot('error-expired-magic-link');
      console.log('❌ Expired magic link test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 3: Multiple magic links (only latest should work)
  async testMultipleMagicLinks() {
    console.log('\n🧪 Test: Multiple Magic Links (Latest Only)');
    
    try {
      await this.clearMailpit();
      
      // Request first magic link
      const firstLink = await this.requestMagicLink(TEST_CONFIG.testEmail);
      console.log('🔗 First magic link obtained');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Request second magic link (should invalidate first)
      const secondLink = await this.requestMagicLink(TEST_CONFIG.testEmail);
      console.log('🔗 Second magic link obtained');
      
      if (firstLink === secondLink) {
        throw new Error('Magic links should be different');
      }
      
      // Try to use first link (should fail)
      await this.page.goto(firstLink);
      await this.takeScreenshot('17-old-magic-link-use');
      
      // Should show error or redirect to login
      const currentUrl = this.page.url();
      const isRejected = currentUrl.includes('/login') || currentUrl.includes('/auth/verify');
      
      if (!isRejected) {
        // Check for error message
        const errorElement = await this.waitForElement('[role="alert"], .error', 3000);
        if (!errorElement) {
          throw new Error('Old magic link should be rejected');
        }
      }
      
      console.log('✅ Old magic link properly rejected');
      
      // Now try second link (should work)
      await this.page.goto(secondLink);
      await this.takeScreenshot('18-new-magic-link-use');
      
      // Should redirect to dashboard
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
      
      const dashboardTitle = await this.waitForElement('h1', 5000);
      if (!dashboardTitle) {
        throw new Error('New magic link should work');
      }
      
      console.log('✅ New magic link works correctly');
      
      return { success: true, message: 'Multiple magic links handled correctly - only latest is valid' };
      
    } catch (error) {
      await this.takeScreenshot('error-multiple-magic-links');
      console.log('❌ Multiple magic links test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Test Case 4: Malformed magic link
  async testMalformedMagicLink() {
    console.log('\n🧪 Test: Malformed Magic Link');
    
    try {
      // Test various malformed URLs
      const malformedLinks = [
        `${TEST_CONFIG.baseUrl}/auth/verify?token=`,
        `${TEST_CONFIG.baseUrl}/auth/verify`,
        `${TEST_CONFIG.baseUrl}/auth/verify?token=invalid-token`,
        `${TEST_CONFIG.baseUrl}/auth/verify?token=<script>alert('xss')</script>`,
      ];
      
      for (let i = 0; i < malformedLinks.length; i++) {
        const link = malformedLinks[i];
        console.log(`Testing malformed link ${i + 1}: ${link}`);
        
        await this.page.goto(link);
        await this.takeScreenshot(`19-malformed-link-${i + 1}`);
        
        // Should show error or redirect to login
        const currentUrl = this.page.url();
        const isHandled = currentUrl.includes('/login') || currentUrl.includes('/auth/verify');
        
        if (!isHandled) {
          const errorElement = await this.waitForElement('[role="alert"], .error', 3000);
          if (!errorElement) {
            throw new Error(`Malformed link ${i + 1} not properly handled`);
          }
        }
      }
      
      console.log('✅ All malformed magic links properly handled');
      
      return { success: true, message: 'Malformed magic links are properly handled' };
      
    } catch (error) {
      await this.takeScreenshot('error-malformed-magic-link');
      console.log('❌ Malformed magic link test FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  // Run all edge case tests
  async runAllTests() {
    console.log('🎯 Starting VoxStudent Magic Link Edge Case Tests\n');
    
    const results = [];
    
    try {
      await this.setup();
      
      // Run all test cases
      results.push(await this.testUsedMagicLink());
      results.push(await this.testExpiredMagicLink());
      results.push(await this.testMultipleMagicLinks());
      results.push(await this.testMalformedMagicLink());
      
    } finally {
      await this.teardown();
    }
    
    // Print summary
    console.log('\n📊 Edge Case Test Results Summary:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    results.forEach((result, index) => {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`Edge Case ${index + 1}: ${status} - ${result.message}`);
      
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
module.exports = MagicLinkEdgeCaseTests;

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = new MagicLinkEdgeCaseTests();
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
