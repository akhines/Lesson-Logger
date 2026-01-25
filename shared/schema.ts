import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models
export * from "./models/auth";
import { users } from "./models/auth";

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

// Students table (children)
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull().references(() => users.id), // Parent user
  gradeLevel: text("grade_level"),
  birthDate: date("birth_date"),
  color: text("color"), // Assigned color for visual distinction
  pin: text("pin"), // 4-6 digit PIN for student login
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
});

// Lessons table
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"), // Could be rich text or description
  link: text("link"), // External link to lesson material
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  dateScheduled: date("date_scheduled").notNull(), // ISO date string YYYY-MM-DD
  completed: boolean("completed").default(false),
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

// Schemas - full schema includes userId for backend
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
const fullInsertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
// Client schema omits userId (server adds it from auth)
export const insertSubjectSchema = fullInsertSubjectSchema.omit({ userId: true });
export const insertSubjectSchemaWithUser = fullInsertSubjectSchema;
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });
export const insertLessonResourceSchema = createInsertSchema(lessonResources).omit({ id: true });

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
