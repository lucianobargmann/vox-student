#!/usr/bin/env node

const VoxStudentE2ETests = require('./auth.test.js');
const MagicLinkEdgeCaseTests = require('./magic-link-edge-cases.test.js');
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.mailpitUrl = 'http://localhost:8025';
    this.devServer = null;
  }

  async checkPrerequisites() {
    console.log('🔍 Checking test prerequisites...\n');
    
    const checks = [];
    
    // Check if Next.js dev server is running
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        checks.push({ name: 'Next.js Dev Server', status: '✅ Running', url: this.baseUrl });
      } else {
        checks.push({ name: 'Next.js Dev Server', status: '❌ Not responding', url: this.baseUrl });
      }
    } catch (error) {
      checks.push({ name: 'Next.js Dev Server', status: '❌ Not running', url: this.baseUrl });
    }
    
    // Check if Mailpit is running
    try {
      const response = await fetch(`${this.mailpitUrl}/api/v1/info`);
      if (response.ok) {
        checks.push({ name: 'Mailpit Email Server', status: '✅ Running', url: this.mailpitUrl });
      } else {
        checks.push({ name: 'Mailpit Email Server', status: '❌ Not responding', url: this.mailpitUrl });
      }
    } catch (error) {
      checks.push({ name: 'Mailpit Email Server', status: '❌ Not running', url: this.mailpitUrl });
    }
    
    // Check database connection (via API)
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`);
      // Even if unauthorized, it means the API is working
      if (response.status === 401 || response.status === 200) {
        checks.push({ name: 'Database Connection', status: '✅ Available', url: 'via API' });
      } else {
        checks.push({ name: 'Database Connection', status: '⚠️  Unknown', url: 'via API' });
      }
    } catch (error) {
      checks.push({ name: 'Database Connection', status: '❌ Not available', url: 'via API' });
    }
    
    // Print results
    console.log('Prerequisites Check:');
    console.log('=' .repeat(60));
    checks.forEach(check => {
      console.log(`${check.name.padEnd(25)} ${check.status.padEnd(20)} ${check.url}`);
    });
    console.log('=' .repeat(60));
    
    // Check if critical services are running
    const criticalFailed = checks.filter(check => 
      (check.name.includes('Next.js') || check.name.includes('Mailpit')) && 
      check.status.includes('❌')
    );
    
    if (criticalFailed.length > 0) {
      console.log('\n❌ Critical services are not running. Please start them first:');
      criticalFailed.forEach(check => {
        if (check.name.includes('Next.js')) {
          console.log('   • Start Next.js: npm run dev');
        }
        if (check.name.includes('Mailpit')) {
          console.log('   • Start Mailpit: ./scripts/setup-mailpit.sh');
        }
      });
      return false;
    }
    
    console.log('\n✅ All prerequisites met. Starting tests...\n');
    return true;
  }

  async startDevServerIfNeeded() {
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        console.log('✅ Dev server already running');
        return true;
      }
    } catch (error) {
      // Server not running, try to start it
      console.log('🚀 Starting Next.js dev server...');
      
      this.devServer = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      });
      
      // Wait for server to start
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds
        
        const checkServer = async () => {
          attempts++;
          try {
            const response = await fetch(this.baseUrl);
            if (response.ok) {
              console.log('✅ Dev server started successfully');
              resolve(true);
              return;
            }
          } catch (error) {
            // Server not ready yet
          }
          
          if (attempts >= maxAttempts) {
            console.log('❌ Failed to start dev server');
            resolve(false);
            return;
          }
          
          setTimeout(checkServer, 1000);
        };
        
        setTimeout(checkServer, 2000); // Wait 2 seconds before first check
      });
    }
  }

  async stopDevServer() {
    if (this.devServer) {
      console.log('🛑 Stopping dev server...');
      this.devServer.kill();
      this.devServer = null;
    }
  }

  async runAllTests() {
    console.log('🎯 VoxStudent E2E Test Suite');
    console.log('=' .repeat(50));
    console.log('Testing magic link authentication system');
    console.log('=' .repeat(50));
    console.log();
    
    // Check prerequisites
    const prerequisitesMet = await this.checkPrerequisites();
    if (!prerequisitesMet) {
      process.exit(1);
    }
    
    const allResults = [];
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    
    try {
      // Run main authentication tests
      console.log('🧪 Running Main Authentication Tests...');
      const authTestRunner = new VoxStudentE2ETests();
      const authResults = await authTestRunner.runAllTests();
      
      allResults.push({
        suite: 'Authentication Tests',
        results: authResults
      });
      
      // Run edge case tests
      console.log('\n🧪 Running Magic Link Edge Case Tests...');
      const edgeCaseTestRunner = new MagicLinkEdgeCaseTests();
      const edgeCaseResults = await edgeCaseTestRunner.runAllTests();
      
      allResults.push({
        suite: 'Edge Case Tests',
        results: edgeCaseResults
      });
      
      // Calculate totals
      allResults.forEach(suite => {
        suite.results.forEach(result => {
          totalTests++;
          if (result.success) {
            totalPassed++;
          } else {
            totalFailed++;
          }
        });
      });
      
      // Print final summary
      console.log('\n🏁 FINAL TEST SUMMARY');
      console.log('=' .repeat(70));
      
      allResults.forEach(suite => {
        console.log(`\n📋 ${suite.suite}:`);
        suite.results.forEach((result, index) => {
          const status = result.success ? '✅ PASSED' : '❌ FAILED';
          console.log(`   ${index + 1}. ${status} - ${result.message}`);
        });
      });
      
      console.log('\n' + '=' .repeat(70));
      console.log(`📊 OVERALL RESULTS:`);
      console.log(`   Total Tests: ${totalTests}`);
      console.log(`   Passed: ${totalPassed} ✅`);
      console.log(`   Failed: ${totalFailed} ❌`);
      console.log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
      console.log('=' .repeat(70));
      
      if (totalFailed === 0) {
        console.log('\n🎉 All tests passed! VoxStudent authentication system is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Please review the results and fix any issues.');
      }
      
      // Return exit code based on results
      return totalFailed === 0 ? 0 : 1;
      
    } catch (error) {
      console.error('\n❌ Test suite failed to run:', error.message);
      return 1;
    }
  }
}

// Test case descriptions for documentation
const TEST_CASES = {
  'Authentication Tests': [
    {
      name: 'Super Admin Login Success',
      description: 'Verifica se luciano@hcktplanet.com pode fazer login com sucesso',
      steps: [
        'Navegar para página de login',
        'Inserir email do super admin',
        'Submeter formulário',
        'Verificar email no Mailpit',
        'Extrair magic link do email',
        'Navegar para magic link',
        'Verificar redirecionamento para dashboard'
      ]
    },
    {
      name: 'Non-existent User Email (Security)',
      description: 'Verifica que emails não são enviados para usuários inexistentes',
      steps: [
        'Usar email que não existe no sistema',
        'Verificar que mensagem de sucesso é exibida (anti-enumeração)',
        'Verificar que NENHUM email é enviado'
      ]
    },
    {
      name: 'Invalid Email Format',
      description: 'Verifica validação de formato de email',
      steps: [
        'Tentar submeter email com formato inválido',
        'Verificar que validação impede submissão'
      ]
    },
    {
      name: 'Backend Not Responding',
      description: 'Verifica tratamento quando backend não responde',
      steps: [
        'Simular falha na API',
        'Verificar que erro é exibido ao usuário'
      ]
    }
  ],
  'Edge Case Tests': [
    {
      name: 'Used Magic Link',
      description: 'Verifica que magic links já utilizados são rejeitados',
      steps: [
        'Usar magic link uma vez (deve funcionar)',
        'Tentar usar o mesmo link novamente (deve falhar)'
      ]
    },
    {
      name: 'Expired Magic Link',
      description: 'Verifica que magic links expirados são rejeitados',
      steps: [
        'Tentar usar token inválido/expirado',
        'Verificar que acesso é negado'
      ]
    },
    {
      name: 'Multiple Magic Links',
      description: 'Verifica que apenas o último magic link é válido',
      steps: [
        'Solicitar primeiro magic link',
        'Solicitar segundo magic link',
        'Verificar que primeiro link é invalidado',
        'Verificar que segundo link funciona'
      ]
    },
    {
      name: 'Malformed Magic Link',
      description: 'Verifica tratamento de URLs malformadas',
      steps: [
        'Testar URLs com tokens vazios, inválidos, ou maliciosos',
        'Verificar que todos são tratados adequadamente'
      ]
    }
  ]
};

// Export test cases for documentation
module.exports = { TestRunner, TEST_CASES };

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}
