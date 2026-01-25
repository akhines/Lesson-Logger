# Scholar - Homeschool Management Application

## Overview

Scholar is a full-stack homeschool management application that helps parents organize lessons, track assignments, and manage curriculum. The application provides a clean dashboard for scheduling lessons across subjects, tracking completion status, and managing student assignments with file upload capabilities.

The system uses a React frontend with a Node.js/Express backend, PostgreSQL for data persistence, and integrates with Replit's authentication and object storage services.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with HMR support

The frontend follows a page-based architecture with shared components. Pages are located in `client/src/pages/` and reusable components in `client/src/components/`. Custom hooks in `client/src/hooks/` handle data fetching and mutations.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Replit Auth (OpenID Connect)
- **Session Management**: express-session with PostgreSQL store
- **File Storage**: Google Cloud Storage via Replit Object Storage integration

API routes are defined in `server/routes.ts` with a typed API contract in `shared/routes.ts`. The storage layer in `server/storage.ts` implements the data access pattern with a clean interface.

### Data Model
Four main entities:
1. **Students** - Children/students being homeschooled with name and grade level
2. **Subjects** - Curriculum subjects with scheduled days, lesson counts, grade level, curriculum source, and optional student assignment
3. **Lessons** - Individual lessons linked to subjects with scheduling and completion tracking
4. **Assignments** - Tasks linked to lessons with status tracking and file upload support (auto-created when lessons are generated)

Schema is defined in `shared/schema.ts` using Drizzle ORM with Zod validation schemas generated via drizzle-zod.

### Curriculum Auto-Generation
When creating a subject, users can select from popular homeschool curricula:
- Saxon Math
- The Good and the Beautiful
- Master Books
- Abeka

Selecting a curriculum and grade level will automatically generate lessons scheduled on the configured school days (defaults to Mon-Fri). The lesson count defaults to 180 but can be customized. Each lesson automatically creates a corresponding assignment for tracking completion.

### Student Management
Parents can add multiple students/children to the system. Each subject can be assigned to a specific student, allowing parents to organize curriculum by child. The Subjects page displays which student each subject belongs to, along with grade level and curriculum badges.

### Authentication Flow
- Uses Replit's OpenID Connect authentication
- Session persistence via PostgreSQL (sessions table)
- User data stored in users table with automatic upsert on login
- Protected routes use `isAuthenticated` middleware

### File Upload Architecture
- Uppy library for frontend file management
- Presigned URL flow for direct-to-storage uploads
- Backend generates upload URLs via `/api/uploads/request-url`
- Files upload directly to Google Cloud Storage

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (provisioned via Replit)
- **Drizzle ORM**: Type-safe database queries and migrations
- **connect-pg-simple**: Session storage in PostgreSQL

### Authentication
- **Replit Auth**: OpenID Connect provider
- **Passport.js**: Authentication middleware with OpenID Client strategy
- **express-session**: Session management

### File Storage
- **Google Cloud Storage**: Object storage via Replit's sidecar service
- **@uppy/core + @uppy/aws-s3**: Frontend file upload handling

### UI Libraries
- **Radix UI**: Accessible component primitives
- **shadcn/ui**: Pre-built component library
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **date-fns**: Date manipulation
- **react-day-picker**: Calendar component

### Build & Development
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development