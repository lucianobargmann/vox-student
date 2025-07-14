# E2E Testing Guide

This project uses Playwright for end-to-end testing of the VoxStudent application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test courses.spec.ts
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

### Test Files

- `tests/e2e/courses.spec.ts` - Complete CRUD tests for courses
- `tests/e2e/auth.spec.ts` - Authentication flow tests
- `tests/e2e/api.spec.ts` - API endpoint tests
- `tests/e2e/helpers/test-utils.ts` - Test utilities and helpers

### Test Coverage

#### Courses CRUD
- ✅ Display courses list
- ✅ Create new course
- ✅ Edit existing course
- ✅ Delete course
- ✅ Search courses
- ✅ Form validation
- ✅ Error handling

#### Authentication
- ✅ Login page display
- ✅ Magic link request
- ✅ Magic link verification
- ✅ User logout
- ✅ Access control (admin/user roles)
- ✅ Invalid token handling

#### API Endpoints
- ✅ Authentication requirements
- ✅ CRUD operations
- ✅ Data validation
- ✅ Error responses
- ✅ Search functionality

## Test Utilities

The `TestHelpers` class provides utilities for:

- **Authentication Mocking**: Mock different user roles and auth states
- **API Mocking**: Mock API responses for consistent testing
- **Form Helpers**: Fill forms with test data
- **Sample Data**: Generate consistent test data

### Example Usage

```typescript
import { TestHelpers } from './helpers/test-utils';

test('my test', async ({ page }) => {
  const helpers = new TestHelpers(page);
  
  // Mock admin authentication
  await helpers.mockAuth('super_admin');
  
  // Mock courses API
  const sampleCourse = helpers.createSampleCourse();
  await helpers.mockCoursesAPI([sampleCourse]);
  
  // Navigate and test
  await page.goto('/admin/courses');
  // ... test assertions
});
```

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- **Base URL**: http://localhost:3000
- **Browsers**: Chromium, Firefox, WebKit
- **Test Directory**: `./tests/e2e`
- **Web Server**: Automatically starts `npm run dev`

## Best Practices

1. **Use Test Helpers**: Leverage the `TestHelpers` class for consistent mocking
2. **Mock APIs**: Always mock API calls for predictable tests
3. **Test Data**: Use the sample data generators for consistency
4. **Assertions**: Use specific selectors and meaningful assertions
5. **Cleanup**: Tests are isolated - no cleanup needed between tests

## Debugging Tests

### Visual Debugging
```bash
npm run test:e2e:debug
```

### Trace Viewer
After a test failure, view the trace:
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### Screenshots
Failed tests automatically capture screenshots in `test-results/`

## CI/CD Integration

Tests are configured to run in CI with:
- Retry on failure (2 retries)
- Single worker for stability
- HTML report generation

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 3000 is available
2. **Database state**: Tests use mocked APIs, no database cleanup needed
3. **Authentication**: Tests mock authentication - no real login required
4. **Timing issues**: Use `waitForLoadState` and proper selectors

### Environment Variables

For real API testing (not recommended for CI):
- `JWT_SECRET`: JWT secret for token verification
- `DATABASE_URL`: Database connection string

## Adding New Tests

1. Create test file in `tests/e2e/`
2. Import `TestHelpers` for utilities
3. Mock required APIs and authentication
4. Write descriptive test names and assertions
5. Update this README if adding new test categories

## Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

The report includes:
- Test results and timing
- Screenshots of failures
- Trace files for debugging
- Browser and OS information
