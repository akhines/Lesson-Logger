import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models
export * from "./models/auth";
// Export chat models for AI wizard
export * from "./models/chat";
import { users } from "./models/auth";

// =====================================================
// ORGANIZATIONS (Co-ops) & ROLES
// =====================================================

export const ORG_ROLES = ["owner", "teacher", "parent"] as const;
export type OrgRole = typeof ORG_ROLES[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Organization Owner",
  teacher: "Teacher",
  parent: "Parent",
};

// Organizations table (co-ops, homeschool groups, etc.)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  settings: text("settings"), // JSON stringified org settings
  isCoopAccount: boolean("is_coop_account").default(false), // True for paid co-op accounts (one-time fee, locked to basic plan)
  coopPaymentStatus: text("coop_payment_status"), // null, 'pending', 'paid'
  coopPaidAt: timestamp("coop_paid_at"), // When one-time fee was paid
  coopStripePaymentId: text("coop_stripe_payment_id"), // Stripe payment intent ID for one-time payment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organization memberships (links users to orgs with roles)
export const orgMemberships = pgTable("org_memberships", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // owner, teacher, parent
  canViewAllWork: boolean("can_view_all_work").default(false), // For owners - explicit permission to view student work
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
  status: text("status").default("pending"), // pending, active, inactive
});

// Classes table (teacher-managed groups of students)
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  teacherUserId: text("teacher_user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  gradeLevel: text("grade_level"),
  scheduledDays: integer("scheduled_days").array().default([1, 2, 3, 4, 5]),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Class enrollments (links students to classes)
export const classEnrollments = pgTable("class_enrollments", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: 'cascade' }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  status: text("status").default("active"), // active, withdrawn, completed
});

// Class Lessons/Assignments (teacher-created, visible to enrolled students/parents)
export const classLessons = pgTable("class_lessons", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: 'cascade' }),
  teacherUserId: text("teacher_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  dueDate: date("due_date"),
  requiresEvidence: boolean("requires_evidence").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Teacher Feedback on Evidence (scoped to family only, never visible to other families)
export const teacherFeedback = pgTable("teacher_feedback", {
  id: serial("id").primaryKey(),
  evidenceId: integer("evidence_id").notNull().references(() => evidenceUploads.id, { onDelete: 'cascade' }),
  teacherUserId: text("teacher_user_id").notNull().references(() => users.id),
  feedback: text("feedback").notNull(),
  grade: text("grade"), // Optional grade/score
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Class Sessions (for attendance tracking - each meeting of a class)
export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: 'cascade' }),
  teacherUserId: text("teacher_user_id").notNull().references(() => users.id),
  sessionDate: date("session_date").notNull(),
  title: text("title"), // Optional title like "Week 1" or "Nature Study Walk"
  notes: text("notes"), // Optional session notes
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance Records (links students to sessions with status)
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => classSessions.id, { onDelete: 'cascade' }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("present"), // present, absent, excused, late
  notes: text("notes"), // Optional notes like reason for absence
  markedBy: text("marked_by").references(() => users.id), // Who recorded this
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email notification preferences for co-op members
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  emailNewAssignment: boolean("email_new_assignment").default(true),
  emailDueSoon: boolean("email_due_soon").default(true),
  emailMissingSubmission: boolean("email_missing_submission").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reminderSettings = pgTable("reminder_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => users.id),
  dailyReminderEnabled: boolean("daily_reminder_enabled").default(false),
  dailyReminderTime: text("daily_reminder_time").default("18:00"),
  weeklySummaryEnabled: boolean("weekly_summary_enabled").default(false),
  weeklySummaryDay: integer("weekly_summary_day").default(0),
  weeklySummaryTime: text("weekly_summary_time").default("09:00"),
  timezone: text("timezone").default("America/New_York"),
  lastDailyReminderSentAt: timestamp("last_daily_reminder_sent_at"),
  lastWeeklySummarySentAt: timestamp("last_weekly_summary_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Charlotte Mason Form Levels (grade groupings)
export const CHARLOTTE_MASON_FORMS = [
  "form_1", // Grades 1-3
  "form_2", // Grades 4-6
  "form_3", // Grades 7-9
] as const;

export const FORM_LABELS: Record<string, string> = {
  form_1: "Form 1 (Grades 1-3)",
  form_2: "Form 2 (Grades 4-6)",
  form_3: "Form 3 (Grades 7-9)",
};

// Subject categories for consistent coloring
export const SUBJECT_CATEGORIES = [
  "language_arts",
  "math", 
  "science",
  "history",
  "art",
  "music",
  "physical_education",
  "foreign_language",
  "other"
] as const;

export const SUBJECT_CATEGORY_COLORS: Record<string, string> = {
  language_arts: "#EF4444", // red
  math: "#3B82F6", // blue
  science: "#22C55E", // green
  history: "#F59E0B", // amber
  art: "#A855F7", // purple
  music: "#EC4899", // pink
  physical_education: "#14B8A6", // teal
  foreign_language: "#F97316", // orange
  other: "#6B7280", // gray
};

// Student colors for differentiation
export const STUDENT_COLORS = [
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#6366F1", // indigo
  "#84CC16", // lime
] as const;

// Predefined cartoon avatars for students
export const STUDENT_AVATARS = [
  "bear", "bunny", "cat", "dog", "elephant", "fox", "giraffe", "koala",
  "lion", "monkey", "owl", "panda", "penguin", "raccoon", "tiger", "unicorn"
] as const;

// Comprehensive curriculum options organized by category
export const CURRICULUM_OPTIONS = {
  math: [
    { name: "Saxon Math", grades: "K-12" },
    { name: "Math With Confidence", grades: "K-6" },
    { name: "Singapore Math — Primary Mathematics", grades: "K-6" },
    { name: "Dimensions Math", grades: "K-8" },
    { name: "Math in Focus", grades: "K-8" },
    { name: "Math Mammoth", grades: "1-7/8" },
    { name: "Math-U-See", grades: "K-12" },
    { name: "RightStart Mathematics", grades: "K-8" },
    { name: "Teaching Textbooks", grades: "3-12" },
    { name: "Khan Academy — Math", grades: "K-12" },
    { name: "ALEKS — Math", grades: "K-12" },
    { name: "CTC Math", grades: "K-12" },
    { name: "Beast Academy", grades: "2-5" },
    { name: "Art of Problem Solving (AoPS)", grades: "6-12" },
    { name: "Eureka Math / EngageNY", grades: "K-12" },
    { name: "Horizons Math", grades: "K-8" },
    { name: "Abeka Math", grades: "K-12" },
    { name: "BJU Press Math", grades: "K-12" },
    { name: "Christian Light Education (CLE) Math", grades: "K-12" },
    { name: "Rod & Staff Math", grades: "1-8" },
    { name: "Life of Fred", grades: "1-12" },
    { name: "Key To… series", grades: "4-12" },
    { name: "Jacobs Algebra", grades: "7-10" },
    { name: "Foerster Algebra / Precalculus", grades: "8-12" },
  ],
  reading_phonics: [
    { name: "All About Reading", grades: "K-8" },
    { name: "Logic of English", grades: "K-8" },
    { name: "The Good and the Beautiful Language Arts", grades: "K-8" },
    { name: "Abeka Language Arts / Reading", grades: "K-12" },
    { name: "BJU Press English / Reading", grades: "K-12" },
    { name: "Sonlight Language Arts", grades: "K-8" },
    { name: "BookShark Language Arts", grades: "K-8" },
    { name: "Memoria Press Reading / Literature", grades: "K-12" },
    { name: "Explode the Code", grades: "K-4" },
    { name: "Teach Your Child to Read in 100 Easy Lessons", grades: "K-2" },
    { name: "Bob Books", grades: "PreK-1" },
    { name: "Reading Eggs", grades: "K-3" },
  ],
  spelling: [
    { name: "All About Spelling", grades: "1-8+" },
    { name: "Spelling You See", grades: "1-8" },
    { name: "Spelling Workout", grades: "1-8" },
    { name: "Rod & Staff Spelling", grades: "2-8" },
    { name: "Megawords", grades: "3-8" },
    { name: "Sequential Spelling", grades: "1-8" },
  ],
  grammar: [
    { name: "Fix It! Grammar (IEW)", grades: "3-12" },
    { name: "Easy Grammar", grades: "3-12" },
    { name: "Rod & Staff English", grades: "2-12" },
    { name: "Michael Clay Thompson (MCT) Grammar", grades: "2-12" },
    { name: "Voyages in English", grades: "1-8" },
    { name: "Hake Grammar & Writing", grades: "3-8" },
  ],
  writing: [
    { name: "Institute for Excellence in Writing (IEW)", grades: "K-12" },
    { name: "Brave Writer", grades: "K-12" },
    { name: "Writing With Ease / Writing With Skill", grades: "1-10" },
    { name: "Essentials in Writing", grades: "K-12" },
    { name: "Writing Strands", grades: "3-12" },
    { name: "The Good and the Beautiful Writing", grades: "K-12" },
  ],
  literature: [
    { name: "Lightning Literature", grades: "1-12" },
    { name: "Moving Beyond the Page", grades: "K-8" },
    { name: "Build Your Library", grades: "K-12" },
    { name: "Core Knowledge Language Arts (CKLA)", grades: "K-8" },
    { name: "Wit & Wisdom", grades: "K-8" },
    { name: "EL Education (ELA)", grades: "K-8" },
  ],
} as const;

// Flat list of all curriculum names for easy access
export const ALL_CURRICULUM_NAMES = [
  ...CURRICULUM_OPTIONS.math.map(c => c.name),
  ...CURRICULUM_OPTIONS.reading_phonics.map(c => c.name),
  ...CURRICULUM_OPTIONS.spelling.map(c => c.name),
  ...CURRICULUM_OPTIONS.grammar.map(c => c.name),
  ...CURRICULUM_OPTIONS.writing.map(c => c.name),
  ...CURRICULUM_OPTIONS.literature.map(c => c.name),
] as const;

// Category labels for curriculum
export const CURRICULUM_CATEGORY_LABELS: Record<string, string> = {
  math: "Math",
  reading_phonics: "Reading & Phonics",
  spelling: "Spelling",
  grammar: "Grammar",
  writing: "Writing & Composition",
  literature: "Literature",
};

// Students table (children)
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull().references(() => users.id), // Parent user
  gradeLevel: text("grade_level"),
  birthDate: date("birth_date"),
  color: text("color"), // Assigned color for visual distinction
  pin: text("pin"), // 4-6 digit PIN for student login
  username: text("username"), // Unique username for student login
  avatar: text("avatar"), // Cartoon avatar identifier
  uploadToken: text("upload_token").unique(), // Unique token for QR code uploads
  organizationId: integer("organization_id").references(() => organizations.id), // Optional org membership
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull().references(() => users.id), // Link to auth user (creator)
  studentId: integer("student_id").references(() => students.id), // Link to student/child (for parent-created subjects)
  classId: integer("class_id").references(() => classes.id), // Link to class (for teacher-created subjects)
  organizationId: integer("organization_id").references(() => organizations.id), // Optional org scope
  scheduledDays: integer("scheduled_days").array().default([1, 2, 3, 4, 5]), // 0=Sun, 1=Mon...
  totalLessons: integer("total_lessons").default(180),
  startLesson: integer("start_lesson").default(1), // Which lesson number to start at (for mid-year joins)
  curriculumSource: text("curriculum_source"),
  gradeLevel: text("grade_level"),
  category: text("category").default("other"), // Subject category for consistent coloring
  formLevel: text("form_level"), // Charlotte Mason Form (form_1, form_2, form_3)
  unitStudy: text("unit_study"), // Unit study name/theme (e.g., "Ancient Egypt", "Oceans")
});

// Subject-Students junction table for many-to-many relationship
export const subjectStudents = pgTable("subject_students", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
});

// Lessons table (unified with assignments - students see these on their calendar)
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"), // Instructions/description for the student
  link: text("link"), // External link to lesson material
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  dateScheduled: date("date_scheduled").notNull(), // ISO date string YYYY-MM-DD
  completed: boolean("completed").default(false),
  formContentId: integer("form_content_id"), // Link to custom Form Content for language arts
  audioDirectionsUrl: text("audio_directions_url"), // URL to audio directions for the student
  status: text("status").default("pending"), // pending, in_progress, completed
  documentUrl: text("document_url"), // For uploaded student work
  grade: text("grade"), // Grade/feedback from parent
});

// Assignments table
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id),
  dueDate: date("due_date"),
  status: text("status").default("pending"), // pending, submitted, graded
  documentUrl: text("document_url"), // For uploaded homework
  grade: text("grade"),
});

// Lesson Resources table (videos, links, etc.)
export const lessonResources = pgTable("lesson_resources", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type").default("link"), // video, link, document, worksheet
  description: text("description"),
});

// Form Content table (Charlotte Mason custom curriculum for language arts)
export const formContent = pgTable("form_content", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  formLevel: text("form_level").notNull(), // form_1, form_2, form_3
  title: text("title").notNull(), // Content title/week number
  weekNumber: integer("week_number"), // Week in the curriculum
  copywork: text("copywork"), // Text for copywork practice
  dictationPrompt: text("dictation_prompt"), // Text for written dictation
  notes: text("notes"), // Additional notes for parents
});

// Days Off table (vacation, holidays, sick days)
export const daysOff = pgTable("days_off", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  reason: text("reason"), // vacation, holiday, sick, etc.
});

// Curriculum Resources table (user-uploaded curriculum from spreadsheets)
export const curriculumResources = pgTable("curriculum_resources", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  term: text("term"), // Term number/name (e.g., "Term 1", "Fall")
  week: integer("week"), // Week number within the term
  formLevel: text("form_level"), // form_1, form_2, form_3
  subject: text("subject").notNull(), // Subject name (e.g., "Language Arts", "History")
  resourceLink: text("resource_link"), // Link to external resource
  chapters: text("chapters"), // Assigned chapters or lesson description
  title: text("title"), // Optional display title
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow(),
});

// Math Facts Practice Sessions (for grading reports)
export const mathFactsSessions = pgTable("math_facts_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: text("user_id").notNull().references(() => users.id), // Parent who owns the student
  operation: text("operation").notNull(), // addition, subtraction, multiplication, division
  maxNumber: integer("max_number").notNull(), // Max number used in problems
  totalProblems: integer("total_problems").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  averageTimeMs: integer("average_time_ms"), // Average time per problem in ms
  completedAt: timestamp("completed_at").defaultNow(),
});

// Student Login Sessions (for attendance tracking)
export const studentLogins = pgTable("student_logins", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: text("user_id").notNull().references(() => users.id), // Parent who owns the student
  loginAt: timestamp("login_at").defaultNow(),
  logoutAt: timestamp("logout_at"), // Optional - when they logged out
  lessonsCompleted: integer("lessons_completed").default(0), // Count of lessons marked complete in this session
});

// Math Facts Assignments (assigned by parent, shown to student as lesson)
export const mathFactsAssignments = pgTable("math_facts_assignments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: text("user_id").notNull().references(() => users.id), // Parent who created assignment
  operation: text("operation").notNull(), // addition, subtraction, multiplication, division
  maxNumber: integer("max_number").notNull().default(12),
  problemCount: integer("problem_count").notNull().default(10),
  requiredAccuracy: integer("required_accuracy").default(80), // Minimum % to pass
  dueDate: date("due_date").notNull(),
  title: text("title"), // Optional custom title
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  sessionId: integer("session_id").references(() => mathFactsSessions.id), // Link to practice session
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const studentsRelations = relations(students, ({ many }) => ({
  subjects: many(subjects),
  subjectStudents: many(subjectStudents),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  student: one(students, {
    fields: [subjects.studentId],
    references: [students.id],
  }),
  lessons: many(lessons),
  subjectStudents: many(subjectStudents),
}));

export const subjectStudentsRelations = relations(subjectStudents, ({ one }) => ({
  subject: one(subjects, {
    fields: [subjectStudents.subjectId],
    references: [subjects.id],
  }),
  student: one(students, {
    fields: [subjectStudents.studentId],
    references: [students.id],
  }),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [lessons.subjectId],
    references: [subjects.id],
  }),
  assignments: many(assignments),
  resources: many(lessonResources),
}));

export const lessonResourcesRelations = relations(lessonResources, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonResources.lessonId],
    references: [lessons.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  lesson: one(lessons, {
    fields: [assignments.lessonId],
    references: [lessons.id],
  }),
}));

export const formContentRelations = relations(formContent, ({ many }) => ({
  lessons: many(lessons),
}));

// Schemas - full schema includes userId for backend
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
const fullInsertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
// Client schema omits userId (server adds it from auth)
export const insertSubjectSchema = fullInsertSubjectSchema.omit({ userId: true });
export const insertSubjectSchemaWithUser = fullInsertSubjectSchema;
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });
export const insertLessonResourceSchema = createInsertSchema(lessonResources).omit({ id: true });
const fullInsertFormContentSchema = createInsertSchema(formContent).omit({ id: true });
export const insertFormContentSchema = fullInsertFormContentSchema.omit({ userId: true });
export const insertFormContentSchemaWithUser = fullInsertFormContentSchema;
const fullInsertDayOffSchema = createInsertSchema(daysOff).omit({ id: true });
export const insertDayOffSchema = fullInsertDayOffSchema.omit({ userId: true });
export const insertDayOffSchemaWithUser = fullInsertDayOffSchema;

const fullInsertCurriculumResourceSchema = createInsertSchema(curriculumResources).omit({ id: true, createdAt: true });
export const insertCurriculumResourceSchema = fullInsertCurriculumResourceSchema.omit({ userId: true });
export const insertCurriculumResourceSchemaWithUser = fullInsertCurriculumResourceSchema;

export const insertSubjectStudentSchema = createInsertSchema(subjectStudents).omit({ id: true });

const fullInsertMathFactsSessionSchema = createInsertSchema(mathFactsSessions).omit({ id: true, completedAt: true });
export const insertMathFactsSessionSchema = fullInsertMathFactsSessionSchema.omit({ userId: true });
export const insertMathFactsSessionSchemaWithUser = fullInsertMathFactsSessionSchema;

const fullInsertStudentLoginSchema = createInsertSchema(studentLogins).omit({ id: true, loginAt: true });
export const insertStudentLoginSchema = fullInsertStudentLoginSchema.omit({ userId: true });
export const insertStudentLoginSchemaWithUser = fullInsertStudentLoginSchema;

const fullInsertMathFactsAssignmentSchema = createInsertSchema(mathFactsAssignments).omit({ id: true, createdAt: true });
export const insertMathFactsAssignmentSchema = fullInsertMathFactsAssignmentSchema.omit({ userId: true });
export const insertMathFactsAssignmentSchemaWithUser = fullInsertMathFactsAssignmentSchema;

// Organization schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrgMembershipSchema = createInsertSchema(orgMemberships).omit({ id: true, invitedAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassEnrollmentSchema = createInsertSchema(classEnrollments).omit({ id: true, enrolledAt: true });

// Class Lessons (teacher-created assignments)
export const insertClassLessonSchema = createInsertSchema(classLessons).omit({ id: true, createdAt: true, updatedAt: true });

// Teacher Feedback on Evidence
export const insertTeacherFeedbackSchema = createInsertSchema(teacherFeedback).omit({ id: true, createdAt: true, updatedAt: true });

// Class Sessions (for attendance)
export const insertClassSessionSchema = createInsertSchema(classSessions).omit({ id: true, createdAt: true });

// Attendance Records
export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true, updatedAt: true });

// Notification Preferences
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });

// Reminder Settings
export const insertReminderSettingsSchema = createInsertSchema(reminderSettings).omit({ id: true, createdAt: true, updatedAt: true, lastDailyReminderSentAt: true, lastWeeklySummarySentAt: true });

// Grammar Practice Assignments (assigned by parent, shown to student)
export const grammarAssignments = pgTable("grammar_assignments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: text("user_id").notNull().references(() => users.id),
  category: text("category").notNull(), // nouns, verbs, adjectives, adverbs, pronouns, prepositions, conjunctions, mixed
  questionCount: integer("question_count").notNull().default(10),
  requiredAccuracy: integer("required_accuracy").default(80),
  dueDate: date("due_date").notNull(),
  title: text("title"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  score: integer("score"), // Percentage score when completed
  createdAt: timestamp("created_at").defaultNow(),
});

const fullInsertGrammarAssignmentSchema = createInsertSchema(grammarAssignments).omit({ id: true, createdAt: true });
export const insertGrammarAssignmentSchema = fullInsertGrammarAssignmentSchema.omit({ userId: true });
export const insertGrammarAssignmentSchemaWithUser = fullInsertGrammarAssignmentSchema;

// Site Settings - for parent/admin customization
export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteSettingSchema = createInsertSchema(siteSettings).omit({ id: true, updatedAt: true });

// Library Items - for personal uploads and external resource links
export const LIBRARY_TYPES = ["personal", "public"] as const;
export const LIBRARY_MEDIA_TYPES = ["audio", "ebook", "pdf", "video", "other"] as const;
export const PUBLIC_SOURCES = ["librivox", "gutenberg", "other"] as const;

export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // personal or public
  mediaType: text("media_type").notNull(), // audio, ebook, pdf, video, other
  title: text("title").notNull(),
  author: text("author"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  fileUrl: text("file_url"), // For personal uploads (object storage)
  externalUrl: text("external_url"), // For public links (Librivox, Gutenberg, etc.)
  source: text("source"), // librivox, gutenberg, other
  sourceId: text("source_id"), // ID from external source for deduplication
  duration: text("duration"), // For audio files
  chapters: integer("chapters"), // Number of chapters/sections
  language: text("language").default("en"),
  tags: text("tags").array(), // For categorization
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const fullInsertLibraryItemSchema = createInsertSchema(libraryItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLibraryItemSchema = fullInsertLibraryItemSchema.omit({ userId: true });
export const insertLibraryItemSchemaWithUser = fullInsertLibraryItemSchema;

// Reading Progress - tracks student reading progress in Gutenberg books
export const readingProgress = pgTable("reading_progress", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  gutenbergId: integer("gutenberg_id").notNull(), // Project Gutenberg book ID
  bookTitle: text("book_title").notNull(), // Cached for display
  bookAuthor: text("book_author"), // Cached for display
  currentChapter: integer("current_chapter").default(0), // Current chapter index
  chapterCount: integer("chapter_count").default(1), // Total chapters in book
  scrollPosition: integer("scroll_position").default(0), // Scroll position within chapter (percentage * 100)
  isComplete: boolean("is_complete").default(false),
  lastReadAt: timestamp("last_read_at").defaultNow(),
  startedAt: timestamp("started_at").defaultNow(),
});

const fullInsertReadingProgressSchema = createInsertSchema(readingProgress).omit({ id: true, startedAt: true });
export const insertReadingProgressSchema = fullInsertReadingProgressSchema.omit({ studentId: true });
export const insertReadingProgressSchemaWithStudent = fullInsertReadingProgressSchema;
export type InsertReadingProgress = z.infer<typeof insertReadingProgressSchemaWithStudent>;
export type ReadingProgress = typeof readingProgress.$inferSelect;

// Portfolio Labels - tags for organizing student work by subject/skill
export const portfolioLabels = pgTable("portfolio_labels", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  subjectId: integer("subject_id").references(() => subjects.id), // Optional - for subject-specific labels
  name: text("name").notNull(),
  color: text("color").default("#6B7280"), // Label color for display
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lesson Logs - free-form daily lesson logging by parents
export const lessonLogs = pgTable("lesson_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  subjectName: text("subject_name").notNull(),
  date: date("date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  title: text("title"),
  notes: text("notes"),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLessonLogSchema = createInsertSchema(lessonLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLessonLog = z.infer<typeof insertLessonLogSchema>;
export type LessonLog = typeof lessonLogs.$inferSelect;

// Evidence Uploads - student work attached to lessons
export const evidenceUploads = pgTable("evidence_uploads", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").references(() => lessons.id),
  classLessonId: integer("class_lesson_id").references(() => classLessons.id), // Optional link to co-op assignment
  studentId: integer("student_id").notNull().references(() => students.id),
  userId: text("user_id").notNull().references(() => users.id), // Parent who owns the student (family ownership)
  title: text("title"),
  description: text("description"),
  fileUrl: text("file_url").notNull(), // Object storage URL
  fileType: text("file_type").notNull(), // image, audio, document, video
  fileName: text("file_name"),
  fileSize: integer("file_size"), // Size in bytes
  uploadedBy: text("uploaded_by").notNull().default("student"), // student or parent
  reviewStatus: text("review_status").notNull().default("pending"), // pending, approved, rejected
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  sharedWithTeacher: boolean("shared_with_teacher").default(true), // If linked to classLessonId, visible to that teacher
  createdAt: timestamp("created_at").defaultNow(),
});

// Evidence Label Links - many-to-many between evidence and labels
export const evidenceLabelLinks = pgTable("evidence_label_links", {
  id: serial("id").primaryKey(),
  evidenceId: integer("evidence_id").notNull().references(() => evidenceUploads.id, { onDelete: 'cascade' }),
  labelId: integer("label_id").notNull().references(() => portfolioLabels.id, { onDelete: 'cascade' }),
});

// Portfolio Share Tokens - secure tokens for public portfolio viewing
export const portfolioShareTokens = pgTable("portfolio_share_tokens", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(), // UUID token for secure access
  expiresAt: timestamp("expires_at"), // Optional expiration
  createdAt: timestamp("created_at").defaultNow(),
});

// PDF Worksheet Annotations - stores student text entries on PDF worksheets
export const pdfAnnotations = pgTable("pdf_annotations", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  pageNumber: integer("page_number").notNull(),
  x: integer("x").notNull(), // X position as percentage (0-100)
  y: integer("y").notNull(), // Y position as percentage (0-100)
  width: integer("width").notNull(), // Width as percentage
  height: integer("height").notNull(), // Height as percentage
  text: text("text").notNull(),
  fontSize: integer("font_size").default(14),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const fullInsertPdfAnnotationSchema = createInsertSchema(pdfAnnotations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPdfAnnotationSchema = fullInsertPdfAnnotationSchema;

// Portfolio schemas
const fullInsertPortfolioLabelSchema = createInsertSchema(portfolioLabels).omit({ id: true, createdAt: true });
export const insertPortfolioLabelSchema = fullInsertPortfolioLabelSchema.omit({ userId: true });
export const insertPortfolioLabelSchemaWithUser = fullInsertPortfolioLabelSchema;

const fullInsertEvidenceUploadSchema = createInsertSchema(evidenceUploads).omit({ id: true, createdAt: true, reviewedAt: true });
export const insertEvidenceUploadSchema = fullInsertEvidenceUploadSchema.omit({ userId: true });
export const insertEvidenceUploadSchemaWithUser = fullInsertEvidenceUploadSchema;

export const insertEvidenceLabelLinkSchema = createInsertSchema(evidenceLabelLinks).omit({ id: true });

// Portfolio share token schemas
const fullInsertPortfolioShareTokenSchema = createInsertSchema(portfolioShareTokens).omit({ id: true, createdAt: true });
export const insertPortfolioShareTokenSchema = fullInsertPortfolioShareTokenSchema;

// Types
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type LessonResource = typeof lessonResources.$inferSelect;
export type InsertLessonResource = z.infer<typeof insertLessonResourceSchema>;
export type FormContent = typeof formContent.$inferSelect;
export type InsertFormContent = z.infer<typeof insertFormContentSchema>;
export type DayOff = typeof daysOff.$inferSelect;
export type InsertDayOff = z.infer<typeof insertDayOffSchema>;
export type CurriculumResource = typeof curriculumResources.$inferSelect;
export type InsertCurriculumResource = z.infer<typeof insertCurriculumResourceSchema>;
export type MathFactsSession = typeof mathFactsSessions.$inferSelect;
export type InsertMathFactsSession = z.infer<typeof insertMathFactsSessionSchema>;
export type StudentLogin = typeof studentLogins.$inferSelect;
export type InsertStudentLogin = z.infer<typeof insertStudentLoginSchema>;
export type MathFactsAssignment = typeof mathFactsAssignments.$inferSelect;
export type InsertMathFactsAssignment = z.infer<typeof insertMathFactsAssignmentSchema>;
export type GrammarAssignment = typeof grammarAssignments.$inferSelect;
export type InsertGrammarAssignment = z.infer<typeof insertGrammarAssignmentSchema>;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = z.infer<typeof insertSiteSettingSchema>;
export type SubjectStudent = typeof subjectStudents.$inferSelect;
export type InsertSubjectStudent = z.infer<typeof insertSubjectStudentSchema>;
export type LibraryItem = typeof libraryItems.$inferSelect;
export type InsertLibraryItem = z.infer<typeof insertLibraryItemSchema>;
export type PdfAnnotation = typeof pdfAnnotations.$inferSelect;
export type InsertPdfAnnotation = z.infer<typeof insertPdfAnnotationSchema>;
export type PortfolioLabel = typeof portfolioLabels.$inferSelect;
export type InsertPortfolioLabel = z.infer<typeof insertPortfolioLabelSchema>;
export type EvidenceUpload = typeof evidenceUploads.$inferSelect;
export type InsertEvidenceUpload = z.infer<typeof insertEvidenceUploadSchema>;
export type EvidenceLabelLink = typeof evidenceLabelLinks.$inferSelect;
export type InsertEvidenceLabelLink = z.infer<typeof insertEvidenceLabelLinkSchema>;
export type PortfolioShareToken = typeof portfolioShareTokens.$inferSelect;
export type InsertPortfolioShareToken = z.infer<typeof insertPortfolioShareTokenSchema>;

// Organization types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrgMembership = typeof orgMemberships.$inferSelect;
export type InsertOrgMembership = z.infer<typeof insertOrgMembershipSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type ClassEnrollment = typeof classEnrollments.$inferSelect;
export type InsertClassEnrollment = z.infer<typeof insertClassEnrollmentSchema>;
export type ClassLesson = typeof classLessons.$inferSelect;
export type InsertClassLesson = z.infer<typeof insertClassLessonSchema>;
export type TeacherFeedback = typeof teacherFeedback.$inferSelect;
export type InsertTeacherFeedback = z.infer<typeof insertTeacherFeedbackSchema>;
export type ClassSession = typeof classSessions.$inferSelect;
export type InsertClassSession = z.infer<typeof insertClassSessionSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = z.infer<typeof insertReminderSettingsSchema>;

// API Request Types (userId is added by server, not client)
export type CreateStudentRequest = Omit<InsertStudent, 'userId'>;
export type UpdateStudentRequest = Partial<Omit<InsertStudent, 'userId'>>;

export type CreateSubjectRequest = Omit<InsertSubject, 'userId'>;
export type UpdateSubjectRequest = Partial<Omit<InsertSubject, 'userId'>>;

export type CreateLessonRequest = InsertLesson;
export type UpdateLessonRequest = Partial<InsertLesson>;

export type CreateAssignmentRequest = InsertAssignment;
export type UpdateAssignmentRequest = Partial<InsertAssignment>;

export type CreateLessonResourceRequest = InsertLessonResource;
export type UpdateLessonResourceRequest = Partial<InsertLessonResource>;

export type CreateFormContentRequest = Omit<InsertFormContent, 'userId'>;
export type UpdateFormContentRequest = Partial<Omit<InsertFormContent, 'userId'>>;

export type CreateDayOffRequest = Omit<InsertDayOff, 'userId'>;
export type UpdateDayOffRequest = Partial<Omit<InsertDayOff, 'userId'>>;

export type CreateCurriculumResourceRequest = Omit<InsertCurriculumResource, 'userId'>;
export type UpdateCurriculumResourceRequest = Partial<Omit<InsertCurriculumResource, 'userId'>>;

export type CreateMathFactsSessionRequest = Omit<InsertMathFactsSession, 'userId'>;
export type CreateStudentLoginRequest = Omit<InsertStudentLogin, 'userId'>;

export type CreateLibraryItemRequest = Omit<InsertLibraryItem, 'userId'>;
export type UpdateLibraryItemRequest = Partial<Omit<InsertLibraryItem, 'userId'>>;

export type CreatePortfolioLabelRequest = Omit<InsertPortfolioLabel, 'userId'>;
export type UpdatePortfolioLabelRequest = Partial<Omit<InsertPortfolioLabel, 'userId'>>;

export type CreateEvidenceUploadRequest = Omit<InsertEvidenceUpload, 'userId'>;
export type UpdateEvidenceUploadRequest = Partial<Omit<InsertEvidenceUpload, 'userId'>>;

// =====================================================
// SITE CONTENT MANAGEMENT (CMS for homepage/settings)
// =====================================================

// Available section types for the homepage builder
export const HOMEPAGE_SECTION_TYPES = [
  "hero",           // Main hero banner with headline/CTA
  "features",       // Feature cards grid
  "pricing",        // Pricing plans display
  "testimonials",   // Customer testimonials
  "faq",            // FAQ accordion
  "cta",            // Call-to-action banner
  "stats",          // Statistics/numbers section
  "how_it_works",   // Step-by-step explanation
  "benefits",       // Benefits list
  "custom_text",    // Custom text block
] as const;

export type HomepageSectionType = typeof HOMEPAGE_SECTION_TYPES[number];

// Site sections (homepage blocks that can be reordered)
export const siteSections = pgTable("site_sections", {
  id: serial("id").primaryKey(),
  sectionType: text("section_type").notNull(), // hero, features, pricing, etc.
  title: text("title"),
  subtitle: text("subtitle"),
  content: text("content"), // JSON stringified content for complex sections
  isEnabled: boolean("is_enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  settings: text("settings"), // JSON stringified settings (colors, layout options)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteSectionSchema = createInsertSchema(siteSections).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSiteSection = z.infer<typeof insertSiteSectionSchema>;
export type SiteSection = typeof siteSections.$inferSelect;

// Note: Site settings table already defined above at line 422
// Using the existing siteSettings table for key-value settings

// Feature items (for the features section)
export const siteFeatures = pgTable("site_features", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"), // Lucide icon name
  plan: text("plan").default("basic"), // basic, premium
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteFeatureSchema = createInsertSchema(siteFeatures).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSiteFeature = z.infer<typeof insertSiteFeatureSchema>;
export type SiteFeature = typeof siteFeatures.$inferSelect;

// Pricing plans (editable pricing display)
export const sitePricingPlans = pgTable("site_pricing_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: text("price").notNull(), // "$29/month"
  description: text("description"),
  features: text("features"), // JSON array of feature strings
  stripePriceId: text("stripe_price_id"),
  isPopular: boolean("is_popular").default(false),
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSitePricingPlanSchema = createInsertSchema(sitePricingPlans).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSitePricingPlan = z.infer<typeof insertSitePricingPlanSchema>;
export type SitePricingPlan = typeof sitePricingPlans.$inferSelect;

// FAQ items
export const siteFaqs = pgTable("site_faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteFaqSchema = createInsertSchema(siteFaqs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSiteFaq = z.infer<typeof insertSiteFaqSchema>;
export type SiteFaq = typeof siteFaqs.$inferSelect;

// Testimonials
export const siteTestimonials = pgTable("site_testimonials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"), // e.g. "Homeschool Mom of 3"
  content: text("content").notNull(),
  avatarUrl: text("avatar_url"),
  rating: integer("rating").default(5),
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSiteTestimonialSchema = createInsertSchema(siteTestimonials).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSiteTestimonial = z.infer<typeof insertSiteTestimonialSchema>;
export type SiteTestimonial = typeof siteTestimonials.$inferSelect;
