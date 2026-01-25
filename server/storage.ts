import { db } from "./db";
import {
  subjects, lessons, assignments, students,
  type Subject, type InsertSubject, type UpdateSubjectRequest,
  type Lesson, type InsertLesson, type UpdateLessonRequest,
  type Assignment, type InsertAssignment, type UpdateAssignmentRequest,
  type Student, type InsertStudent, type UpdateStudentRequest
} from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Students
  getStudents(userId: string): Promise<Student[]>;
  getStudent(id: number, userId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, userId: string, updates: UpdateStudentRequest): Promise<Student | undefined>;
  deleteStudent(id: number, userId: string): Promise<boolean>;

  // Subjects
  getSubjects(userId: string): Promise<Subject[]>;
  getSubject(id: number, userId: string): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, userId: string, updates: UpdateSubjectRequest): Promise<Subject | undefined>;
  deleteSubject(id: number, userId: string): Promise<boolean>;
  generateLessonsFromCurriculum(subjectId: number, curriculumSource: string): Promise<void>;

  // Lessons
  getLessons(subjectId?: number, startDate?: string, endDate?: string): Promise<Lesson[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  updateLesson(id: number, updates: UpdateLessonRequest): Promise<Lesson>;
  deleteLesson(id: number): Promise<void>;

  // Assignments
  getAssignments(lessonId?: number): Promise<Assignment[]>;
  getAssignment(id: number): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: number, updates: UpdateAssignmentRequest): Promise<Assignment>;
  deleteAssignment(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Students
  async getStudents(userId: string): Promise<Student[]> {
    return await db.select().from(students).where(eq(students.userId, userId));
  }

  async getStudent(id: number, userId: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(and(eq(students.id, id), eq(students.userId, userId)));
    return student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [newStudent] = await db.insert(students).values(student as any).returning();
    return newStudent;
  }

  async updateStudent(id: number, userId: string, updates: UpdateStudentRequest): Promise<Student | undefined> {
    const [updatedStudent] = await db.update(students).set(updates).where(and(eq(students.id, id), eq(students.userId, userId))).returning();
    return updatedStudent;
  }

  async deleteStudent(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(students).where(and(eq(students.id, id), eq(students.userId, userId)));
    return true;
  }

  // Subjects
  async getSubjects(userId: string): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.userId, userId));
  }

  async getSubject(id: number, userId: string): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
    return subject;
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject as any).returning();
    return newSubject;
  }

  async updateSubject(id: number, userId: string, updates: UpdateSubjectRequest): Promise<Subject | undefined> {
    const [updatedSubject] = await db.update(subjects).set(updates).where(and(eq(subjects.id, id), eq(subjects.userId, userId))).returning();
    return updatedSubject;
  }

  async deleteSubject(id: number, userId: string): Promise<boolean> {
    await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
    return true;
  }

  async generateLessonsFromCurriculum(subjectId: number, curriculumSource: string): Promise<void> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
    if (!subject) return;

    const grade = subject.gradeLevel || "K";
    const scheduledDays = subject.scheduledDays || [1, 2, 3, 4, 5];
    let currentDate = new Date();
    
    // Helper to get next scheduled day
    const getNextScheduledDate = () => {
      while (!scheduledDays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      const dateStr = currentDate.toISOString().split('T')[0];
      currentDate.setDate(currentDate.getDate() + 1);
      return dateStr;
    };
    
    let lessonCount = subject.totalLessons || 180;
    let lessonPrefix = curriculumSource;
    
    if (curriculumSource.toLowerCase().includes("saxon math")) {
      lessonPrefix = `Grade ${grade} Math`;
    } else if (curriculumSource.toLowerCase().includes("the good and the beautiful")) {
      lessonPrefix = `Grade ${grade} Language Arts`;
      lessonCount = Math.min(lessonCount, 120);
    }
    
    // Create lessons with proper dates
    for (let i = 1; i <= lessonCount; i++) {
      const lesson = {
        title: `${lessonPrefix} - Lesson ${i}`,
        content: `${curriculumSource} Grade ${grade}, Lesson ${i}`,
        subjectId: subjectId,
        dateScheduled: getNextScheduledDate(),
      };
      await this.createLesson(lesson as any);
    }
  }

  // Lessons
  async getLessons(subjectId?: number, startDate?: string, endDate?: string): Promise<Lesson[]> {
    let conditions = [];
    if (subjectId) conditions.push(eq(lessons.subjectId, subjectId));
    if (startDate) conditions.push(gte(lessons.dateScheduled, startDate));
    if (endDate) conditions.push(lte(lessons.dateScheduled, endDate));
    
    return await db.select().from(lessons).where(and(...conditions));
  }

  async getLesson(id: number): Promise<Lesson | undefined> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, id));
    return lesson;
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const [newLesson] = await db.insert(lessons).values(lesson as any).returning();
    
    // Auto-create assignment for this lesson
    await this.createAssignment({
      title: `Complete ${newLesson.title}`,
      description: `Assignment for ${newLesson.title}`,
      lessonId: newLesson.id,
      dueDate: newLesson.dateScheduled,
      status: "pending",
    });
    
    return newLesson;
  }

  async updateLesson(id: number, updates: UpdateLessonRequest): Promise<Lesson> {
    const [updatedLesson] = await db.update(lessons).set(updates).where(eq(lessons.id, id)).returning();
    
    // If the date changed, we might need to shift subsequent lessons
    if (updates.dateScheduled) {
      const lesson = await this.getLesson(id);
      if (lesson) {
        await this.shiftLessons(lesson.subjectId, lesson.dateScheduled);
      }
    }
    
    return updatedLesson;
  }

  async deleteLesson(id: number): Promise<void> {
    const lesson = await this.getLesson(id);
    if (lesson) {
      await db.delete(lessons).where(eq(lessons.id, id));
      await this.shiftLessons(lesson.subjectId, lesson.dateScheduled);
    }
  }

  private async shiftLessons(subjectId: number, fromDate: string): Promise<void> {
    const subject = await this.getSubject(subjectId);
    if (!subject) return;

    const scheduledDays = subject.scheduledDays || [1, 2, 3, 4, 5];
    const subsequentLessons = await db.select()
      .from(lessons)
      .where(and(eq(lessons.subjectId, subjectId), gte(lessons.dateScheduled, fromDate)))
      .orderBy(lessons.dateScheduled);

    let currentDate = new Date(fromDate);
    
    for (const lesson of subsequentLessons) {
      // Find the next available school day
      while (!scheduledDays.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const dateString = currentDate.toISOString().split('T')[0];
      if (lesson.dateScheduled !== dateString) {
        await db.update(lessons)
          .set({ dateScheduled: dateString })
          .where(eq(lessons.id, lesson.id));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Assignments
  async getAssignments(lessonId?: number): Promise<Assignment[]> {
    if (lessonId) {
      return await db.select().from(assignments).where(eq(assignments.lessonId, lessonId));
    }
    return await db.select().from(assignments);
  }

  async getAssignment(id: number): Promise<Assignment | undefined> {
    const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
    return assignment;
  }

  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const [newAssignment] = await db.insert(assignments).values(assignment).returning();
    return newAssignment;
  }

  async updateAssignment(id: number, updates: UpdateAssignmentRequest): Promise<Assignment> {
    const [updatedAssignment] = await db.update(assignments).set(updates).where(eq(assignments.id, id)).returning();
    return updatedAssignment;
  }

  async deleteAssignment(id: number): Promise<void> {
    await db.delete(assignments).where(eq(assignments.id, id));
  }
}

export const storage = new DatabaseStorage();
