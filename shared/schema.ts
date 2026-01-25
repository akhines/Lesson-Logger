import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models
export * from "./models/auth";
// Export chat models for AI wizard
export * from "./models/chat";
import { users } from "./models/auth";

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
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull().references(() => users.id), // Link to auth user
  studentId: integer("student_id").references(() => students.id), // Link to student/child
  scheduledDays: integer("scheduled_days").array().default([1, 2, 3, 4, 5]), // 0=Sun, 1=Mon...
  totalLessons: integer("total_lessons").default(180),
  curriculumSource: text("curriculum_source"),
  gradeLevel: text("grade_level"),
  category: text("category").default("other"), // Subject category for consistent coloring
  formLevel: text("form_level"), // Charlotte Mason Form (form_1, form_2, form_3)
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

// Relations
export const studentsRelations = relations(students, ({ many }) => ({
  subjects: many(subjects),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  student: one(students, {
    fields: [subjects.studentId],
    references: [students.id],
  }),
  lessons: many(lessons),
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
