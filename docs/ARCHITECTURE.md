# VoxStudent - System Architecture Document

## Overview
VoxStudent is a modern student management system built with Next.js 15, leveraging the App Router architecture for a full-stack solution. The system integrates facial recognition, WhatsApp automation, and comprehensive course management capabilities.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  React Components │ Face Recognition │ Camera Controls │ WhatsApp   │
│  Tailwind CSS     │ face-api.js      │ MediaDevices   │ QR Code    │
├─────────────────────────────────────────────────────────────────────┤
│                        APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────────┤
│  Next.js App Router │ API Routes │ Server Actions │ Middleware     │
│  Authentication     │ Services   │ Utilities      │ Validation     │
├─────────────────────────────────────────────────────────────────────┤
│                          DATA LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│  Prisma ORM │ SQLite/PostgreSQL │ File Storage │ Session Storage  │
├─────────────────────────────────────────────────────────────────────┤
│                       INTEGRATION LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  WhatsApp Web.js │ Email (SMTP/Mailpit) │ Face Recognition Models │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Technologies
- **Next.js 15.3.5**: React framework with App Router
- **React 19**: Component-based UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components
- **React Hook Form**: Form management with validation
- **Zod**: Schema validation
- **Lucide React**: Icon library

### Backend Technologies
- **Node.js**: JavaScript runtime
- **Next.js API Routes**: RESTful API endpoints
- **Prisma ORM**: Database abstraction layer
- **SQLite**: Development database
- **PostgreSQL**: Production database (optional)
- **JWT**: Session management
- **bcryptjs**: Password hashing

### Integration Technologies
- **face-api.js**: Facial recognition library
- **whatsapp-web.js**: WhatsApp Web automation
- **Nodemailer**: Email service
- **Mailpit**: Development email testing

### DevOps & Testing
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Puppeteer**: End-to-end testing
- **Jest**: Unit testing
- **Playwright**: E2E testing framework
- **Traefik**: Reverse proxy and SSL termination

## Application Architecture

### 1. Frontend Architecture

#### Component Hierarchy
```
App Layout
├── Authentication Components
│   ├── LoginForm
│   ├── MagicLinkVerification
│   └── WhatsAppAuth
├── Admin Dashboard
│   ├── CourseManagement
│   ├── StudentManagement
│   ├── AttendanceControl
│   │   ├── FaceRecognition
│   │   ├── CameraSelector
│   │   └── ManualAttendance
│   ├── WhatsAppPanel
│   └── ReportsModule
└── Student Portal
    ├── EnrollmentStatus
    ├── AttendanceHistory
    └── MakeupScheduling
```

#### State Management
- **React Context**: Global state for authentication and user data
- **React Hooks**: Local component state management
- **Custom Hooks**: Reusable stateful logic
- **Server State**: Managed through Next.js server components

#### Routing Structure
```
/                           # Public home page
/login                      # Authentication page
/auth/verify               # Magic link verification
/auth/whatsapp            # WhatsApp authentication
/admin/*                  # Admin-only routes
  ├── /courses            # Course management
  ├── /classes            # Class management
  ├── /students           # Student management
  ├── /attendance         # Attendance control
  ├── /reminder-templates # Message templates
  ├── /reports            # Analytics dashboard
  ├── /security           # Security monitoring
  ├── /settings           # System configuration
  └── /whatsapp           # WhatsApp integration
/api/*                    # API endpoints
  ├── /auth/*             # Authentication endpoints
  ├── /courses/*          # Course CRUD operations
  ├── /students/*         # Student CRUD operations
  ├── /attendance/*       # Attendance tracking
  ├── /whatsapp/*         # WhatsApp integration
  ├── /queue/*            # Message queue management
  └── /face-recognition/* # Facial recognition endpoints
```

### 2. Backend Architecture

#### Service Layer Pattern
```
Controllers (API Routes)
├── Authentication Controller
├── Course Controller
├── Student Controller
├── Attendance Controller
├── WhatsApp Controller
└── Reports Controller
        ↓
Services Layer
├── AuthService
├── CourseService
├── StudentService
├── AttendanceService
├── WhatsAppService
└── ReportsService
        ↓
Data Access Layer (Prisma)
├── User Repository
├── Course Repository
├── Student Repository
├── Attendance Repository
└── WhatsApp Repository
```

#### API Design
- **RESTful Endpoints**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON Response Format**: Consistent API response structure
- **Error Handling**: Centralized error handling with proper HTTP codes
- **Request Validation**: Input validation using Zod schemas
- **Rate Limiting**: API rate limiting for security

#### Authentication Flow
```
1. User enters email/phone
2. System generates magic link
3. Magic link sent via email/WhatsApp
4. User clicks link → JWT token generated
5. JWT stored in HTTP-only cookie
6. Subsequent requests include JWT
7. Middleware validates JWT on protected routes
```

### 3. Database Architecture

#### Data Model Overview
```
User (Authentication)
├── UserProfile (Extended user data)
├── Session (Active sessions)
└── MagicLink (Authentication tokens)

Academic Structure
├── Course (Course definitions)
├── Class (Course instances)
├── Lesson (Individual lessons)
├── Student (Student records)
├── Enrollment (Student-Class relationships)
└── Attendance (Attendance records)

Communication
├── ReminderTemplate (Message templates)
├── WhatsAppMessage (Message records)
├── WhatsAppSettings (Configuration)
├── MessageQueue (Scheduled messages)
└── WhatsAppLog (Activity logs)

Security & Audit
├── AuditLog (Data changes)
└── SecurityEvent (Security incidents)
```

#### Database Relationships
- **One-to-Many**: User → UserProfile, Course → Classes, Class → Lessons
- **Many-to-Many**: Students ↔ Classes (via Enrollment)
- **One-to-One**: User → UserProfile, WhatsApp → WhatsAppSettings
- **Polymorphic**: AuditLog (references multiple entity types)

### 4. Integration Architecture

#### WhatsApp Integration
```
WhatsApp Web.js
├── QR Code Authentication
├── Session Management
├── Message Queue Processing
├── Contact Validation
└── Event Logging
```

#### Facial Recognition Pipeline
```
Camera Input → Face Detection → Feature Extraction → Comparison → Result
     ↓              ↓              ↓              ↓          ↓
MediaDevices → face-api.js → Neural Networks → Database → Attendance
```

#### Email Integration
```
Development: Mailpit (Local SMTP)
Production: External SMTP (Gmail, SendGrid, etc.)
           ↓
Message Queue → Template Processing → Email Delivery
```

## Security Architecture

### Authentication Security
- **Passwordless Authentication**: No password storage risks
- **JWT Tokens**: Stateless authentication with expiration
- **Rate Limiting**: Prevents brute force attacks
- **Session Management**: Secure session handling
- **CSRF Protection**: Cross-site request forgery protection

### Data Security
- **Encryption**: Data encrypted in transit (HTTPS) and at rest
- **Password Hashing**: bcrypt for any password storage
- **Input Validation**: All inputs validated and sanitized
- **SQL Injection Prevention**: Prisma ORM prevents SQL injection
- **XSS Prevention**: React's built-in XSS protection

### Access Control
- **Role-Based Access Control (RBAC)**: Multi-level user roles
- **Route Protection**: Middleware-based route protection
- **API Security**: Authentication required for all protected endpoints
- **Audit Logging**: Comprehensive activity logging

### Privacy & Compliance
- **LGPD Compliance**: Brazilian data protection law compliance
- **Biometric Data**: Secure handling of facial recognition data
- **Data Retention**: Configurable data retention policies
- **Data Export**: GDPR-compliant data export functionality

## Deployment Architecture

### Development Environment
```
Developer Machine
├── Next.js Dev Server (Port 3000)
├── SQLite Database
├── Mailpit SMTP (Port 1025)
└── File System Storage
```

### Production Environment
```
Production Server
├── Docker Containers
│   ├── VoxStudent App Container
│   ├── Database Container (PostgreSQL)
│   ├── Traefik Reverse Proxy
│   └── SSL Certificate Management
├── Persistent Volumes
│   ├── Database Storage
│   ├── WhatsApp Sessions
│   └── Upload Files
└── Monitoring & Logging
```

### CI/CD Pipeline
```
Git Repository → GitHub Actions → Build → Test → Deploy
                      ↓
                Docker Build → Registry → Production Server
```

## Performance Architecture

### Frontend Performance
- **Code Splitting**: Automatic code splitting with Next.js
- **Image Optimization**: Next.js image optimization
- **Caching**: Browser caching and CDN integration
- **Lazy Loading**: Component and route lazy loading
- **Bundle Analysis**: Webpack bundle analyzer

### Backend Performance
- **Database Optimization**: Indexed queries and connection pooling
- **Caching Strategy**: Redis for session and data caching
- **API Optimization**: Efficient queries and pagination
- **Background Jobs**: Message queue for async processing
- **Monitoring**: Performance monitoring and alerting

### Real-time Features
- **WebSocket Support**: Real-time updates for attendance
- **Server-Sent Events**: Live notifications
- **Camera Streaming**: Efficient video processing
- **Message Queue**: Asynchronous message processing

## Monitoring & Observability

### Application Monitoring
- **Health Checks**: Application health endpoints
- **Metrics Collection**: Custom metrics for business logic
- **Error Tracking**: Comprehensive error logging
- **Performance Monitoring**: Response time and throughput metrics

### Security Monitoring
- **Audit Logs**: All user actions logged
- **Security Events**: Failed logins, suspicious activities
- **Compliance Reporting**: LGPD compliance monitoring
- **Incident Response**: Automated security incident detection

### Infrastructure Monitoring
- **Container Health**: Docker container monitoring
- **Database Performance**: Query performance and connection metrics
- **Network Monitoring**: SSL certificate expiration, DNS health
- **Storage Monitoring**: Disk usage and backup verification

## Scalability Architecture

### Horizontal Scaling
- **Stateless Application**: Session stored in database/Redis
- **Load Balancing**: Multiple application instances
- **Database Scaling**: Read replicas and connection pooling
- **Microservices Ready**: Modular architecture for future splitting

### Vertical Scaling
- **Resource Optimization**: CPU and memory optimization
- **Database Tuning**: Query optimization and indexing
- **Caching Strategy**: Multi-layer caching implementation
- **Asset Optimization**: Static asset optimization

### Future Considerations
- **Message Queues**: Redis/RabbitMQ for high-volume messaging
- **File Storage**: Cloud storage integration (AWS S3, Google Cloud)
- **CDN Integration**: Content delivery network for global reach
- **Multi-tenant Architecture**: Support for multiple institutions

## Testing Architecture

### Unit Testing
- **Jest Framework**: JavaScript/TypeScript unit testing
- **Component Testing**: React component testing
- **Service Testing**: Business logic testing
- **Utility Testing**: Helper function testing

### Integration Testing
- **API Testing**: Endpoint integration testing
- **Database Testing**: Data layer testing
- **Service Integration**: Inter-service communication testing
- **WhatsApp Integration**: Mock WhatsApp testing

### End-to-End Testing
- **Puppeteer Framework**: Browser automation testing
- **Critical Path Testing**: User journey testing
- **Facial Recognition Testing**: Camera and recognition testing
- **Authentication Flow Testing**: Login and permission testing

### Test Environment
```
Test Database (SQLite)
├── Seed Data
├── Test Fixtures
└── Mock Services
     ├── Mock WhatsApp
     ├── Mock Email
     └── Mock Camera
```

## Documentation Architecture

### Technical Documentation
- **API Documentation**: OpenAPI/Swagger specifications
- **Database Schema**: Entity relationship diagrams
- **Architecture Diagrams**: System architecture visuals
- **Code Documentation**: Inline code comments and JSDoc

### User Documentation
- **Admin Manual**: Administrator user guide
- **Student Manual**: Student user guide
- **Deployment Guide**: Production deployment instructions
- **Troubleshooting Guide**: Common issues and solutions

### Development Documentation
- **Setup Guide**: Development environment setup
- **Contributing Guide**: Code contribution guidelines
- **Testing Guide**: Testing strategy and execution
- **Security Guide**: Security best practices

This architecture provides a robust, scalable, and maintainable foundation for the VoxStudent system, ensuring it can grow with the institution's needs while maintaining security and performance standards.