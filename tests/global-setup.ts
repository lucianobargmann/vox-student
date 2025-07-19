import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting QA Environment Global Setup...');
  
  const { baseURL } = config.projects[0].use;
  
  // Launch browser for health checks
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log(`📡 Checking if application is ready at ${baseURL}`);
    
    // Wait for application to be ready with retries
    let retries = 0;
    const maxRetries = 30; // 5 minutes with 10 second intervals
    
    while (retries < maxRetries) {
      try {
        const response = await page.goto(`${baseURL}/api/health`, { 
          timeout: 10000,
          waitUntil: 'networkidle'
        });
        
        if (response?.ok()) {
          console.log('✅ Application is ready!');
          break;
        }
        
        throw new Error(`Health check failed with status: ${response?.status()}`);
      } catch (error) {
        retries++;
        console.log(`⏳ Attempt ${retries}/${maxRetries} failed. Retrying in 10 seconds...`);
        console.log(`   Error: ${error}`);
        
        if (retries >= maxRetries) {
          throw new Error(`❌ Application failed to start after ${maxRetries} attempts`);
        }
        
        await page.waitForTimeout(10000);
      }
    }
    
    // Check database connection
    console.log('🔍 Checking database connectivity...');
    try {
      const dbResponse = await page.goto(`${baseURL}/api/health/db`, { 
        timeout: 10000 
      });
      
      if (dbResponse?.ok()) {
        console.log('✅ Database connection verified!');
      }
    } catch (error) {
      console.log('⚠️  Database health check failed, but continuing...');
    }
    
    // Seed test data if needed
    console.log('🌱 Checking if test data seeding is needed...');
    try {
      const seedResponse = await page.goto(`${baseURL}/api/seed/qa`, { 
        timeout: 30000 
      });
      
      if (seedResponse?.ok()) {
        console.log('✅ Test data seeded successfully!');
      }
    } catch (error) {
      console.log('⚠️  Test data seeding failed, but continuing...');
      console.log(`   Error: ${error}`);
    }
    
    console.log('🎉 Global setup completed successfully!');
    
  } finally {
    await browser.close();
  }
}

export default globalSetup;