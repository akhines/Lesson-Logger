# Sunwoven Homeschool - Management Application

## Overview
Sunwoven Homeschool is a comprehensive full-stack application designed to empower parents in managing their homeschool curriculum and student activities. It offers robust tools for lesson organization, assignment tracking, and monitoring student progress, all within a clean and intuitive interface. The platform supports various educational methodologies, including the Charlotte Mason method, and aims to simplify homeschool administration. Key capabilities include scheduling, student task management with file uploads, and a student portal for interactive learning. The project envisions providing deep insights into student performance, curated curriculum content, and advanced reporting features to a broad user base. The application also supports homeschool co-ops through a multi-tenant architecture, offering specialized features and role-based access controls. Monetization is achieved through a subscription system offering Basic and Premium plans, with a 7-day free trial and options for additional students.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React 18 with TypeScript
-   **State Management**: TanStack React Query
-   **UI Components**: shadcn/ui (built on Radix UI), Tailwind CSS for styling
-   **Forms**: React Hook Form with Zod validation
-   **Build**: Vite

### Backend
-   **Framework**: Express.js with TypeScript
-   **Database ORM**: Drizzle ORM
-   **Authentication**: Replit Auth (OpenID Connect)
-   **Session Management**: `express-session` with PostgreSQL store
-   **File Storage**: Google Cloud Storage via Replit Object Storage

### Data Model
The system manages students, subjects, lessons, lesson resources, and form content. It also supports multi-tenancy for organizations (co-ops), handling memberships, classes, and class enrollments. Lessons include assignment details like status, document URLs, and grades.

### Multi-Tenant Architecture (Co-op Support)
The platform supports homeschool co-ops with role-based access control. Co-op accounts are identified by an `isCoopAccount` flag, supporting a one-time payment model and custom logo branding.
-   **Roles**: Owner, Teacher, Parent
-   **Permissions**: Granular control over student data, class management, and lesson access. Parents only access their children's data. Teachers access students in their classes. Owners manage settings and rosters, with optional `canViewAllWork` flag.
-   **Evidence Scoping**: Differentiates between Co-op Lesson/Assignment evidence and Family Evidence, ensuring privacy and appropriate sharing with teachers.

### Key Features
-   **Student Portal**: PIN-based access for students to manage lessons, assignments, and access specialized tools (Writing Center, Art Studio, Math Facts Practice).
-   **Lesson & Curriculum Management**: Supports Charlotte Mason forms, curriculum auto-generation (e.g., Saxon Math), and AI-powered curriculum upload for parsing content from various formats. Includes weekly schedule view and days off scheduling.
-   **Student Management**: Tools for adding multiple students, assigning subjects, and managing student-specific settings.
-   **Interactive Learning Tools**: Audio lesson directions, AI-powered study helper, Student Writing Center, Student Art Studio, and Math Facts Practice.
-   **Student Portfolio System**: Comprehensive management of student work evidence, including photo/file uploads, parent review queue (approve/reject/label), and professional PDF export with statistics and chronological ordering.
-   **QR Code Upload**: Unique QR codes for each student to facilitate easy photo uploads of completed work directly to the parent's review queue.
-   **Email Notifications**: Automated notifications for new assignments, due soon reminders, and missing submissions, with per-organization user preferences.
-   **Content Management System (CMS)**: Admin-only visual homepage builder with drag-and-drop reordering for site sections, features, pricing, FAQs, and testimonials.
-   **Subscription System**: Monetization via Stripe, offering Basic and Premium plans with a 7-day free trial. Features are gated based on the user's subscription status.

## External Dependencies

### Database
-   **PostgreSQL**
-   **Drizzle ORM**
-   **connect-pg-simple** (for session storage)

### Authentication
-   **Replit Auth** (OpenID Connect)
-   **Passport.js**
-   **express-session**

### File Storage
-   **Google Cloud Storage**
-   **@uppy/core + @uppy/aws-s3**

### AI/ML
-   **OpenAI GPT-4o** (for curriculum parsing)

### PDF Generation
-   **PDFKit**

### UI Libraries
-   **Radix UI**
-   **shadcn/ui**
-   **Tailwind CSS**
-   **Lucide React**
-   **date-fns**
-   **react-day-picker**
-   **@tiptap/react**

### Payments
-   **Stripe**
-   **stripe-replit-sync**

### Email Service
-   **Resend API**

### Build & Development
-   **Vite**
-   **esbuild**
-   **tsx**