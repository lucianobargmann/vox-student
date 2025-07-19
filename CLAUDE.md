# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoxStudent is a modern student management system built with Next.js 15, featuring facial recognition attendance, WhatsApp integration, and comprehensive course management. It's a full-stack application using passwordless authentication and providing both admin and student portals.

## Common Development Commands

### Development Server
```bash
npm run dev                    # Start development server (http://localhost:3000)
```

### Database Operations
```bash
npm run db:generate           # Generate Prisma client
npm run db:push              # Push schema changes to database
npm run db:migrate           # Run database migrations
npm run db:studio            # Open Prisma Studio
```

### Testing & Quality Assurance
```bash
npm run lint                 # Run ESLint
npm run typecheck           # Run TypeScript type checking
npm run test                # Run unit tests with Jest
npm run test:coverage       # Run tests with coverage
npm run test:e2e            # Run Playwright E2E tests
npm run test:e2e:qa         # Run QA-specific E2E tests
```

### Build & Deployment
```bash
npm run build               # Build for production (may have TypeScript errors but builds successfully)
npm run start              # Start production server
```

### Important Notes About Build Process
- The build process may show TypeScript errors but will complete successfully
- Always run `npm run lint && npm run typecheck` before committing to identify issues
- **Tailwind CSS v4 Configuration:**
  - Uses `@import "tailwindcss"` in `globals.css`
  - Content sources defined with `@source "./src/**/*.{js,ts,jsx,tsx,mdx}"`
  - No separate `tailwind.config.js` file needed (v4 style)
  - PostCSS configured with `@tailwindcss/postcss` and `autoprefixer` plugins
  - Dependencies: `tailwindcss@4.1.11`, `@tailwindcss/postcss@4.1.11`, `autoprefixer`

### QA Environment
```bash
npm run qa:setup            # Set up QA environment with Docker
npm run qa:test             # Run full QA test suite
npm run qa:teardown         # Tear down QA environment
npm run pre-release         # Run complete pre-release QA checks
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (dev), PostgreSQL (production)
- **Authentication**: Passwordless (magic links via email/WhatsApp)
- **Integrations**: face-api.js (facial recognition), whatsapp-web.js, Nodemailer

### Key Directory Structure
```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── admin/             # Admin-only pages (courses, students, attendance)
│   ├── api/               # REST API endpoints
│   ├── auth/              # Authentication pages
│   └── login/             # Public login page
├── components/            # React components
│   ├── ui/                # Reusable UI components (shadcn/ui based)
│   ├── layouts/           # Layout components
│   └── navigation/        # Navigation components
├── lib/                   # Shared utilities and services
│   ├── services/          # Business logic services
│   ├── auth.ts           # Authentication utilities
│   ├── prisma.ts         # Database client
│   └── utils.ts          # Common utilities
├── contexts/              # React contexts (AuthContext)
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript type definitions
```

### Database Schema
The application uses Prisma ORM with key entities:
- **User/UserProfile**: Authentication and user data
- **Course/Class/Lesson**: Academic structure
- **Student/Enrollment**: Student management and class enrollments
- **Attendance**: Facial recognition and manual attendance tracking
- **WhatsApp integration**: Message templates, queue, and logging
- **Security**: Audit logs and security events

### Service Layer Pattern
Business logic is organized in service classes under `src/lib/services/`:
- `auth.service.ts` - Authentication and user management
- `students.service.ts` - Student CRUD operations
- `courses.service.ts` - Course management
- `attendance.service.ts` - Attendance tracking
- `whatsapp.service.ts` - WhatsApp messaging integration

### Authentication Flow
1. Passwordless authentication using magic links
2. Links sent via email or WhatsApp
3. JWT tokens stored in HTTP-only cookies
4. Role-based access control (admin, user)
5. Middleware protection for admin routes

### Key Features
- **Facial Recognition**: Uses face-api.js for attendance marking
- **WhatsApp Integration**: Automated messaging for reminders and notifications
- **Multi-device Camera Support**: Camera selection and management
- **Lesson Generation**: Automated lesson scheduling
- **Attendance Control**: Both facial recognition and manual attendance
- **Reports & Analytics**: Comprehensive reporting dashboard

### Testing Strategy
- **Unit Tests**: Jest for utilities and services (`src/lib/__tests__/`)
- **E2E Tests**: Playwright for user workflows (`tests/e2e/`)
- **QA Tests**: Dedicated QA suite (`*.qa.spec.ts`) for pre-release validation
- **API Tests**: Integration tests for API endpoints

### Security Considerations
- Passwordless authentication (no password storage)
- JWT tokens with expiration
- RBAC with middleware protection
- Audit logging for all actions
- Secure biometric data handling
- LGPD compliance for Brazilian data protection

### WhatsApp Integration
- Session management with QR code authentication
- Message queue for scheduled reminders
- Template-based messaging system
- Contact validation and logging
- Automated makeup lesson notifications

### Development Workflow
1. Use `npm run dev` for development server
2. Run `npm run lint && npm run typecheck` before commits
3. Database changes require `npm run db:generate` after schema updates
4. QA environment available via `npm run qa:setup` for testing
5. Pre-release validation with `npm run pre-release`

### Important Notes
- Camera permissions required for facial recognition features
- WhatsApp integration requires QR code scanning for session setup
- Development uses SQLite, production uses PostgreSQL
- Facial recognition models are pre-loaded in `/public/models/`
- Email testing uses Mailpit in development (port 1025)
- Docker compose files available for different environments (dev, QA, production)