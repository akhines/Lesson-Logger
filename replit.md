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
Six main entities:
1. **Students** - Children/students being homeschooled with name, grade level, assigned color (from palette), and optional PIN for student portal login
2. **Subjects** - Curriculum subjects with scheduled days, lesson counts, grade level, curriculum source, category (for color coding), optional student assignment, and optional Form Level for Charlotte Mason approach
3. **Lessons** - Individual lessons linked to subjects with scheduling, completion tracking, and optional link to Form Content
4. **Assignments** - Tasks linked to lessons with status tracking and file upload support (auto-created when lessons are generated)
5. **Lesson Resources** - Videos, documents, worksheets, and links associated with lessons
6. **Form Content** - Charlotte Mason curriculum content organized by Form level and week, containing copywork and dictation prompts

Schema is defined in `shared/schema.ts` using Drizzle ORM with Zod validation schemas generated via drizzle-zod.

### Color Coding System
The application uses a consistent color coding system:
- **Subject Categories** - Each subject can be assigned a category (language_arts, math, science, history, art, music, physical_education, foreign_language, other) with predefined colors (SUBJECT_CATEGORY_COLORS in schema.ts)
- **Student Colors** - Each student has an assigned color from a predefined palette (STUDENT_COLORS in schema.ts) for easy visual identification across the app
- Weekly assignment views display color-coded assignments by subject category with student color indicators

### Student Portal
Students can access their own portal with a PIN-based login (separate from parent auth):
- Students select their name from a dropdown and enter their PIN (4-6 digits)
- Student portal shows: today's lessons, pending assignments, completed assignments, weekly overview
- Protected routes redirect unauthenticated students to /student-login
- **Security Note**: PIN storage is currently plaintext - should be hashed before production use

### Charlotte Mason Forms
The application supports the Charlotte Mason educational approach with three Form levels:
- **Form 1** (Ages 6-9): Early elementary curriculum
- **Form 2** (Ages 9-12): Upper elementary curriculum  
- **Form 3** (Ages 12-15): Middle school curriculum

Parents can create Form Content for each level containing:
- **Copywork** - Text passages for students to copy for handwriting and language arts practice
- **Dictation Prompts** - Passages for dictation exercises
- **Notes** - Additional teacher/parent notes for each week

Form Content is organized by week number (1-36 for a typical school year). When creating a Language Arts subject with a Form Level assigned, lessons are automatically linked to matching Form Content by week. The student portal displays copywork and dictation prompts for each day's lessons.

### Curriculum Auto-Generation
When creating a subject, users can select from popular homeschool curricula:
- Saxon Math
- The Good and the Beautiful
- Master Books
- Abeka

Selecting a curriculum and grade level will automatically generate lessons scheduled on the configured school days (defaults to Mon-Fri). The lesson count defaults to 180 but can be customized. Each lesson automatically creates a corresponding assignment for tracking completion.

For Language Arts subjects with a Form Level, lessons are linked to Form Content by week number. Week number is calculated as: `Math.ceil(lessonNumber / lessonsPerWeek)` where lessonsPerWeek is the number of scheduled school days.

### AI Curriculum Upload
Parents can import curriculum table of contents directly from images, PDFs, or text using AI-powered parsing. Access this feature via the three-dot menu on any subject card on the Subjects page.

**Workflow:**
1. Upload an image, PDF, or paste text of the curriculum table of contents
2. AI extracts and parses chapters/lessons from the content
3. Review and select which chapters to import
4. Choose a start date and school days for scheduling
5. Lessons and assignments are automatically created

**Technical Details:**
- Uses OpenAI GPT-4o for vision-based text extraction and parsing
- Supports image formats (PNG, JPG, GIF, WebP) and PDF files
- AI output validated with Zod schemas for data integrity
- UTC date handling prevents timezone-related scheduling issues
- Service located in `server/services/curriculumParser.ts`
- API endpoints: POST `/api/curriculum/parse` and POST `/api/curriculum/generate-lessons`

### Weekly Schedule View
The Schedule page displays a weekly calendar view showing all 7 days (Monday-Sunday) with lessons for each day.

**Features:**
- Week navigation with previous/next buttons and "Today" quick navigation
- Lessons displayed as cards with subject color coding
- Click to mark lessons complete/incomplete
- Add/edit/delete lessons directly from the calendar
- Weekly progress stats (completed/total)

### Days Off / Vacation Scheduling
Parents can schedule days off (vacations, holidays, sick days) which automatically reschedules affected lessons.

**Workflow:**
1. Click "Day Off" button at the bottom of any weekday column
2. Optionally enter a reason (Vacation, Holiday, Sick Day, etc.)
3. Lessons scheduled for that day are automatically moved to the next valid school day
4. Days off are visually marked on the calendar

**Technical Details:**
- Days off stored in `days_off` table with userId, date, and reason
- Duplicate date prevention per user
- Automatic lesson bumping respects subject's scheduled school days
- Corresponding assignments are also rescheduled
- Removing a day off does not restore original lesson dates (one-way operation)
- API endpoints: GET/POST/DELETE `/api/days-off`

### Student Management
Parents can add multiple students/children to the system. Each subject can be assigned to a specific student, allowing parents to organize curriculum by child. The Subjects page displays which student each subject belongs to, along with grade level, curriculum, and category badges.

Features:
- **Student Colors** - Each student has an assigned color for visual distinction
- **Student PIN** - Optional PIN (4-6 digits) enables student portal access
- **Filtering** - Assignments page can be filtered by student and subject
- **Weekly View** - Color-coded weekly calendar view of assignments

### Authentication Flow
- Uses Replit's OpenID Connect authentication
- Session persistence via PostgreSQL (sessions table)
- User data stored in users table with automatic upsert on login
- Protected routes use `isAuthenticated` middleware

### Audio Lesson Directions
Parents can record or upload audio directions for each lesson, which students can play back from the Student Portal.

**Features:**
- Record audio directly in the browser using the microphone
- Upload existing MP3/audio files
- Playback preview before saving
- Audio indicator icon on Schedule page for lessons with audio directions
- Student Portal displays "Listen to Directions" button for lessons with audio

**Technical Details:**
- Uses browser MediaRecorder API for recording
- Audio files stored in Object Storage via presigned URL flow
- `audioDirectionsUrl` field on lessons table stores the object path
- Component: `AudioDirectionsRecorder` in lesson creation/edit dialog

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