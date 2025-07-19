# VoxStudent QA Environment

This document describes the QA (Quality Assurance) environment setup for automated testing using Docker and Playwright.

## 🏗️ Architecture

The QA environment consists of:

- **PostgreSQL Database** (`postgres-qa`) - Isolated test database
- **Mailpit** - Email testing service with web UI
- **VoxStudent App** (`app-qa`) - Application running in QA mode
- **Puppeteer Tests** - Automated E2E tests using Playwright

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)

### Running QA Tests

1. **Setup and run all tests:**
   ```bash
   npm run qa:full
   ```

2. **Manual setup (for debugging):**
   ```bash
   # Start QA environment
   npm run qa:setup
   
   # Wait for services to be ready (30-60 seconds)
   
   # Run tests
   npm run test:e2e:qa
   
   # Cleanup when done
   npm run qa:teardown
   ```

3. **Run tests with Docker:**
   ```bash
   npm run qa:test
   ```

### Individual Commands

- `npm run qa:setup` - Start QA environment (Docker Compose)
- `npm run qa:teardown` - Stop and cleanup QA environment
- `npm run qa:test` - Run containerized tests
- `npm run qa:logs` - View logs from all services
- `npm run test:e2e:qa` - Run QA tests locally

## 🧪 Test Coverage

### Implemented E2E Tests

#### ✅ Reminder Templates (`reminder-templates.qa.spec.ts`)
- Create/Edit/Delete templates
- Variable validation ({{nome_do_aluno}}, etc.)
- Template categories and descriptions
- Responsive design testing

#### ✅ Authentication System (`auth-system.qa.spec.ts`)
- Passwordless login with magic links
- Email validation
- Role-based access control
- Session persistence
- WhatsApp authentication flow
- Rate limiting tests

#### ✅ Course Management (`course-management.qa.spec.ts`)
- Course CRUD operations
- Class scheduling and management
- Automatic lesson generation
- Validation and conflict detection
- Search and pagination

#### ✅ Student Management (`student-management.qa.spec.ts`)
- Student profile management
- Enrollment system
- Capacity management
- Student transfers
- Search and filtering
- Bulk operations

#### 🚧 Planned Tests
- Attendance Control (facial recognition, camera management)
- WhatsApp Integration (connection, messaging, templates)
- Communication Features (automated reminders, email)
- Security & Compliance (monitoring, LGPD)

## 🔧 Configuration

### Environment Variables (.env.qa)

Key QA-specific configurations:

```bash
NODE_ENV="qa"
QA_MODE="true"
SEED_DATA="true"
AUTO_APPROVE_USERS="true"
HEADLESS="true"
```

### Service URLs

- **Application**: http://localhost:3001
- **Mailpit UI**: http://localhost:8025
- **PostgreSQL**: localhost:5433

## 📊 Test Results

Test artifacts are saved to:

- `test-results/` - Test reports and videos
- `screenshots/` - Test screenshots
- `test-results/html-report/` - HTML test report

### Viewing Results

```bash
# Open HTML report
npx playwright show-report test-results/html-report

# View screenshots
ls screenshots/

# Check test videos
ls test-results/videos/
```

## 🐛 Debugging

### View Application Logs

```bash
npm run qa:logs
```

### Run Tests in Headed Mode

```bash
# Local debugging with visible browser
npx playwright test tests/e2e/*.qa.spec.ts --headed --debug
```

### Access Services

```bash
# Check application health
curl http://localhost:3001/api/health

# View emails in Mailpit
open http://localhost:8025

# Connect to QA database
docker exec -it voxstudent-postgres-qa psql -U voxstudent -d voxstudent_qa
```

### Common Issues

1. **Services not ready**: Wait 30-60 seconds after `qa:setup`
2. **Port conflicts**: Stop other instances of the application
3. **Database issues**: Run `npm run qa:teardown` and `npm run qa:setup`

## 📝 Writing New Tests

### Test Structure

```typescript
import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Feature Name E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    page = await context.newPage();
    
    // Login if needed
    await page.goto(`${BASE_URL}`);
    await page.fill('input[type="email"]', 'admin@qa.voxstudent.com');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  });

  test('should test specific functionality', async () => {
    // Test implementation
  });
});
```

### Best Practices

1. **Use descriptive test names**: `01 - Should create new reminder template`
2. **Take screenshots**: Before and after each test
3. **Clean up test data**: Delete created test items
4. **Handle async operations**: Use `waitForLoadState('networkidle')`
5. **Make tests independent**: Each test should work alone

## 📈 CI/CD Integration

### GitHub Actions Example

```yaml
name: QA Tests

on: [push, pull_request]

jobs:
  qa-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run qa:full
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## 🔐 Security Notes

- QA environment uses test credentials only
- Database is isolated and ephemeral
- No production data is used
- All test emails go to Mailpit (local)

## 📚 Further Reading

- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose Guide](https://docs.docker.com/compose/)
- [VoxStudent Development Guide](./README.md)