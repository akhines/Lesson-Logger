# Sunwoven Homeschool - Management Application

## Overview

Sunwoven Homeschool is a full-stack application designed to help parents manage their homeschool curriculum and student activities. It provides tools for organizing lessons, tracking assignments, and monitoring student progress. The platform offers a clean interface for scheduling, managing student tasks with file uploads, and supporting various educational approaches including the Charlotte Mason method. The project aims to streamline homeschool administration, provide valuable insights into student performance, and potentially offer curated curriculum content and advanced reporting to a wider user base.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend uses a page-based architecture, organizing reusable components and custom hooks for data handling.

### Backend
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Session Management**: express-session with PostgreSQL store
- **File Storage**: Google Cloud Storage via Replit Object Storage

API routes are defined with a typed contract, and a clean storage layer interface is maintained.

### Data Model
The system manages five core entities: Students, Subjects, Lessons, Lesson Resources, and Form Content. Lessons now include assignment details like status, document URLs, and grades. A consistent color-coding system is used for subjects and students.

### Key Features
- **Student Portal**: PIN-based login for students to view and manage their lessons, assignments, and access specialized tools like the Writing Center, Art Studio, and Math Facts Practice.
- **Charlotte Mason Forms**: Supports Form 1, 2, and 3 content (Copywork, Dictation Prompts) organized by week, linking automatically to Language Arts subjects.
- **Curriculum Auto-Generation**: Automates lesson scheduling from popular curricula (e.g., Saxon Math) based on selected grade level and school days.
- **AI Curriculum Upload**: Allows parents to import curriculum tables of contents from images, PDFs, or text using OpenAI GPT-4o for parsing and automatic lesson generation.
- **Weekly Schedule View**: Provides a calendar view of lessons with navigation, completion tracking, and quick lesson management.
- **Days Off / Vacation Scheduling**: Enables scheduling days off, which automatically reschedules affected lessons.
- **Student Management**: Allows adding multiple students, assigning subjects, and managing student-specific settings like PINs and colors.
- **Audio Lesson Directions**: Parents can record or upload audio instructions for lessons, accessible by students.
- **File Upload Architecture**: Utilizes Uppy library with a presigned URL flow for direct uploads to object storage.
- **Study Helper with Lesson Integration**: AI-powered study assistant where students can ask questions. Parents can highlight text from AI responses and add it directly to new or existing lessons using a floating "Add to Lesson" button.
- **Student Writing Center**: A rich text editor for students to create and edit documents.
- **Student Art Studio**: A canvas-based drawing tool for digital artwork creation.
- **Math Facts Practice**: Interactive drills for basic arithmetic, tracking student performance.
- **Admin Settings & User Management**: Provides administrators (Ashley Hines) with tools for user management, parent account impersonation, student portal viewing, PIN management, and website content management.
- **Reports**: Comprehensive reporting for Math Facts grading, attendance tracking, and student activity.
- **Library**: Personal library for uploading custom audio recordings and documents, plus search integration with Librivox (public domain audiobooks) and Project Gutenberg (free ebooks). Library items can be linked directly to lessons as resources.
- **Multi-Student Subject Assignment**: Subjects can be assigned to multiple students using a junction table (subject_students), with color-coded badges showing all assigned students.
- **Student Portfolio System**: Complete portfolio management for tracking student work evidence. Students can upload photos/files of their completed work from the lesson dialog. Parents review uploads in a queue with approve/reject/labeling capabilities. Portfolio labels allow categorizing work by type. PDF export generates a formatted portfolio grouped by student and label.
- **QR Code Upload**: Each student has a unique QR code that can be scanned to quickly upload work photos. Parents access the QR code from the student menu (Students page → student card menu → "Upload QR Code"). When scanned, the QR code opens a mobile-friendly upload page where photos can be taken or files selected. Uploads go directly to the parent's portfolio review queue. QR codes can be printed and posted near the student's workspace for easy access.
- **Content Management System (CMS)**: Complete homepage content management with drag-and-drop reordering:
  - **Homepage Builder**: Admin-only visual page builder at `/homepage-builder` accessible from Admin Settings
  - **CMS Entities**: site_sections, site_features, site_pricing_plans, site_faqs, site_testimonials with sortOrder for drag-and-drop
  - **Public API**: `/api/site/content` returns all CMS content (sections, features, pricingPlans, faqs, testimonials) for dynamic landing page rendering
  - **Admin API**: `/api/admin/cms/*` routes protected with `protect + requireAdmin` middleware for CRUD operations
  - **Field Naming**: Uses `isEnabled` field for toggling visibility, `sectionType` for categorizing sections (hero, features, pricing, etc.)
  - Uses @dnd-kit/core and @dnd-kit/sortable for drag-and-drop functionality
- **Subscription System**: Monetization with Stripe subscriptions:
  - **7-Day Free Trial**: New users automatically get a 7-day trial with full premium access (no credit card required)
  - **Basic Plan ($29/month)**: Dashboard, students (up to 3 included), schedule, subjects, reports, portfolio uploads & review
  - **Premium Plan ($49/month)**: Everything in Basic, plus Library, AI Curriculum Upload, Study Helper, Math Facts Practice, Grammar Practice, Copywork Generator
  - **Additional Students**: $10/month each beyond the 3 included
  - Uses `stripe-replit-sync` for automatic Stripe data synchronization to PostgreSQL
  - Webhook handling registered BEFORE express.json() middleware for raw body access
  - Feature gating via `/api/features/:feature` endpoint and `FeatureGate` component
  - Trial users (`subscriptionPlan: "trial"`) get premium features until `trialEndDate` expires

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: Type-safe database interactions.
- **connect-pg-simple**: PostgreSQL session storage.

### Authentication
- **Replit Auth**: OpenID Connect provider.
- **Passport.js**: Authentication middleware.
- **express-session**: Session management.

### File Storage
- **Google Cloud Storage**: Object storage.
- **@uppy/core + @uppy/aws-s3**: Frontend file upload library.

### AI/ML
- **OpenAI GPT-4o**: For AI curriculum parsing.

### PDF Generation
- **PDFKit**: Server-side PDF generation for portfolio exports.

### UI Libraries
- **Radix UI**: Accessible component primitives.
- **shadcn/ui**: Pre-built React components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **date-fns**: Date manipulation utility.
- **react-day-picker**: Calendar component.
- **@tiptap/react**: Rich text editor framework.

### Payments
- **Stripe**: Payment processing and subscription management.
- **stripe-replit-sync**: Automatic syncing of Stripe data to PostgreSQL stripe schema.

### Build & Development
- **Vite**: Frontend build tool.
- **esbuild**: Server bundling.
- **tsx**: TypeScript execution.

## Subscription System

### Setup Instructions
1. Run `npx tsx server/seed-products.ts` to create Stripe products (Basic, Premium, Additional Student)
2. Products will be synced automatically to the `stripe` schema tables
3. Webhook is handled at `/api/stripe/webhook` (registered BEFORE express.json middleware)

### API Endpoints
- `GET /api/stripe/config` - Returns Stripe publishable key
- `GET /api/subscription` - Returns user's current subscription status
- `GET /api/subscription/plans` - Returns available products/prices from stripe.products
- `POST /api/subscription/checkout` - Creates Stripe checkout session
- `POST /api/subscription/portal` - Creates customer portal session
- `GET /api/features/:feature` - Checks if user has access to a feature

### Feature Gating
- Basic features: dashboard, students, schedule, subjects, labels, reports, uploads, review_queue, portfolio
- Premium features: library, curriculum, ai_curriculum, study_helper, math_facts, grammar_practice, copywork_generator
- Use `FeatureGate` component to conditionally render content based on subscription
- Use `useHasFeature` hook for programmatic feature checks