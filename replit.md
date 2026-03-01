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
The system manages students, subjects, lessons, lesson resources, lesson logs, and form content. It also supports multi-tenancy for organizations (co-ops), handling memberships, classes, and class enrollments. Lessons include assignment details like status, document URLs, and grades. Lesson Logs provide free-form daily learning activity tracking with student, subject, duration, tags, and notes.

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
-   **Student Portfolio System**: Unified Portfolio view at `/portfolio` with two tabs: (1) **Learning Timeline** — lesson logs + evidence merged into a grouped chronological view (Month → Subject), with student auto-select, date presets, filters (subject, tag, "Has Evidence"), evidence thumbnails with lightbox preview, select mode for export, and orphan evidence section; powered by `GET /api/portfolio/timeline` endpoint. (2) **Evidence Review** — parent review queue (approve/reject/label), professional PDF export with statistics and chronological ordering. Includes **Shareable Portfolio Links** — create public read-only share links scoped to a student with optional date range, expiration, password protection (bcryptjs), and download control. Public view at `/portfolio/:token` with password gate, revoked/expired states. Manage links at `/manage-share-links` with revoke/delete. API: `POST/GET /api/share-links`, `POST /api/share-links/:id/revoke`, `DELETE /api/share-links/:id`, `GET/POST /api/share/:token`.
-   **QR Code Upload**: Unique QR codes for each student to facilitate easy photo uploads of completed work directly to the parent's review queue.
-   **Email Notifications**: Automated notifications for new assignments, due soon reminders, and missing submissions, with per-organization user preferences.
-   **Content Management System (CMS)**: Admin-only visual homepage builder with drag-and-drop reordering for site sections, features, pricing, FAQs, and testimonials.
-   **Lesson Logging**: Free-form daily lesson logging with student, subject, duration, tags, and notes. Includes filtering, summary totals, and a full CRUD interface at `/lesson-logging`.
-   **Onboarding Wizard**: Full-screen wizard at `/onboarding` for new users. 3 steps: Add Students (name, grade, color) → Pick Subjects (templates or custom) → Success/Log Today. Auto-redirects from Dashboard when no students and onboarding not complete. `onboardingComplete` flag on users table. Endpoints: `GET /api/onboarding/status`, `POST /api/onboarding/complete`, `POST /api/onboarding/skip`.
-   **Activation Checklist**: Data-driven "Getting Started" widget on Dashboard shown when `onboardingComplete=false` and user has students. 5 items: add students, set up subjects (≥3), log first lesson, create schedule, upload evidence. Progress bar and deep-link CTAs. Dismissible when all complete.
-   **Dashboard with Next Steps**: Enhanced dashboard featuring a Quick Log CTA, "Next Steps" recommendation engine (rules-based, personalized suggestions), "Progress at a Glance" stats (weekly minutes, lesson count, day streak), and "Recent Activity" feed with edit/duplicate actions.
-   **Reminder System**: Opt-in email reminders at `/reminders`. Daily reminder (sends if no lessons logged by chosen time) and weekly summary (total time, lessons, subjects, evidence count). Timezone-aware, idempotent (max 1 email/day), with 30-day inactivity cutoff. Uses Resend integration. Internal cron endpoint `POST /api/internal/run-reminders` secured via SESSION_SECRET header. Dashboard shows context-aware banner (CTA if reminders off, status if on).
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

## Privacy & COPPA Compliance

### Child Data Protection
The platform is designed with COPPA (Children's Online Privacy Protection Act) compliance in mind:

**Parental Consent Model:**
- Student accounts are created and authorized exclusively by parents
- Students do not create their own accounts or provide personal information
- Parent's account serves as the legal consent gate for all child data

**Data Minimization:**
- Only essential data is collected for students (name, grade level, optional avatar)
- Birth date field exists but is not collected or displayed in the UI
- No addresses, phone numbers, or other sensitive PII collected for students

**First-Name-Only Display:**
- In co-op contexts, teachers and other org members see only student first names
- Full names are only visible to the student's own parent
- `getFirstName()` helper used in Organizations.tsx for teacher views

**Data Deletion:**
- Parents can delete evidence/work samples: `DELETE /api/portfolio/evidence/:id`
- Co-op owners can remove members: `DELETE /api/organizations/:orgId/members/:memberId`
- Student data follows parent account lifecycle

**Evidence Scoping:**
- Family evidence is private by default
- Evidence shared with teachers requires explicit `sharedWithTeacher=true` flag
- Teachers only see work submitted to their classes, never family's personal work