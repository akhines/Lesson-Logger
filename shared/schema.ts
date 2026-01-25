import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models
export * from "./models/auth";
import { users } from "./models/auth";

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull().references(() => users.id), // Link to auth user
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

// Relations
export const subjectsRelations = relations(subjects, ({ many }) => ({
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [lessons.subjectId],
    references: [subjects.id],
  }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  lesson: one(lessons, {
    fields: [assignments.lessonId],
    references: [lessons.id],
  }),
}));

// Schemas
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, userId: true });
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });

// Types
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

// API Request Types
export type CreateSubjectRequest = InsertSubject;
export type UpdateSubjectRequest = Partial<InsertSubject>;

export type CreateLessonRequest = InsertLesson;
export type UpdateLessonRequest = Partial<InsertLesson>;

export type CreateAssignmentRequest = InsertAssignment;
export type UpdateAssignmentRequest = Partial<InsertAssignment>;
