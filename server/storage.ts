import { db } from "./db";
import {
  subjects, lessons, assignments, students, lessonResources, formContent, daysOff, curriculumResources,
  mathFactsSessions, studentLogins, mathFactsAssignments, siteSettings, users,
  insertDayOffSchemaWithUser, insertCurriculumResourceSchemaWithUser,
  insertMathFactsSessionSchemaWithUser, insertStudentLoginSchemaWithUser, insertMathFactsAssignmentSchemaWithUser,
  type Subject, type InsertSubject, type UpdateSubjectRequest,
  type Lesson, type InsertLesson, type UpdateLessonRequest,
  type Assignment, type InsertAssignment, type UpdateAssignmentRequest,
  type Student, type InsertStudent, type UpdateStudentRequest,
  type LessonResource, type InsertLessonResource, type UpdateLessonResourceRequest,
  type FormContent, type InsertFormContent, type UpdateFormContentRequest,
  type DayOff, type UpdateDayOffRequest,
  type CurriculumResource, type UpdateCurriculumResourceRequest,
  type MathFactsSession, type StudentLogin, type MathFactsAssignment, type SiteSetting, type User
} from "@shared/schema";
import { z } from "zod";

type InsertDayOffWithUser = z.infer<typeof insertDayOffSchemaWithUser>;
type InsertCurriculumResourceWithUser = z.infer<typeof insertCurriculumResourceSchemaWithUser>;
type InsertMathFactsSessionWithUser = z.infer<typeof insertMathFactsSessionSchemaWithUser>;
type InsertStudentLoginWithUser = z.infer<typeof insertStudentLoginSchemaWithUser>;
type InsertMathFactsAssignmentWithUser = z.infer<typeof insertMathFactsAssignmentSchemaWithUser>;
import { eq, and, gte, lte, inArray, asc } from "drizzle-orm";

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
  getAssignments(filters?: { lessonId?: number; studentId?: number; subjectId?: number; startDate?: string; endDate?: string }): Promise<Assignment[]>;
  getAssignment(id: number): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: number, updates: UpdateAssignmentRequest): Promise<Assignment>;
  deleteAssignment(id: number): Promise<void>;

  // Lesson Resources
  getLessonResources(lessonId?: number): Promise<LessonResource[]>;
  getLessonResource(id: number): Promise<LessonResource | undefined>;
  createLessonResource(resource: InsertLessonResource): Promise<LessonResource>;
  updateLessonResource(id: number, updates: UpdateLessonResourceRequest): Promise<LessonResource>;
  deleteLessonResource(id: number): Promise<void>;

  // Form Content (Charlotte Mason custom curriculum)
  getFormContent(userId: string, formLevel?: string): Promise<FormContent[]>;
  getFormContentById(id: number, userId: string): Promise<FormContent | undefined>;
  createFormContent(content: InsertFormContent): Promise<FormContent>;
  updateFormContent(id: number, userId: string, updates: UpdateFormContentRequest): Promise<FormContent | undefined>;
  deleteFormContent(id: number, userId: string): Promise<boolean>;

  // Student Auth
  verifyStudentPin(studentId: number, pin: string): Promise<Student | null>;

  // Days Off
  getDaysOff(userId: string): Promise<DayOff[]>;
  createDayOff(dayOff: InsertDayOffWithUser): Promise<DayOff>;
  deleteDayOff(id: number, userId: string): Promise<boolean>;
  bumpLessonsForDayOff(userId: string, dayOffDate: string): Promise<number>;

  // Curriculum Resources
  getCurriculumResources(userId: string, filters?: { subject?: string; formLevel?: string; term?: string }): Promise<CurriculumResource[]>;
  getCurriculumResource(id: number, userId: string): Promise<CurriculumResource | undefined>;
  createCurriculumResource(resource: InsertCurriculumResourceWithUser): Promise<CurriculumResource>;
  createCurriculumResourcesBulk(resources: InsertCurriculumResourceWithUser[]): Promise<CurriculumResource[]>;
  updateCurriculumResource(id: number, userId: string, updates: UpdateCurriculumResourceRequest): Promise<CurriculumResource | undefined>;
  deleteCurriculumResource(id: number, userId: string): Promise<boolean>;
  deleteCurriculumResourcesBySubject(userId: string, subject: string): Promise<boolean>;

  // Math Facts Sessions
  getMathFactsSessions(userId: string, studentId?: number, startDate?: Date, endDate?: Date): Promise<MathFactsSession[]>;
  createMathFactsSession(session: InsertMathFactsSessionWithUser): Promise<MathFactsSession>;

  // Student Logins (Attendance)
  getStudentLogins(userId: string, studentId?: number, startDate?: Date, endDate?: Date): Promise<StudentLogin[]>;
  createStudentLogin(login: InsertStudentLoginWithUser): Promise<StudentLogin>;
  updateStudentLogin(id: number, userId: string, updates: Partial<StudentLogin>): Promise<StudentLogin | undefined>;

  // Math Facts Assignments
  getMathFactsAssignments(userId: string, studentId?: number): Promise<MathFactsAssignment[]>;
  getMathFactsAssignment(id: number, userId: string): Promise<MathFactsAssignment | undefined>;
  getMathFactsAssignmentsForStudent(studentId: number): Promise<MathFactsAssignment[]>;
  createMathFactsAssignment(assignment: InsertMathFactsAssignmentWithUser): Promise<MathFactsAssignment>;
  updateMathFactsAssignment(id: number, userId: string, updates: Partial<MathFactsAssignment>): Promise<MathFactsAssignment | undefined>;
  deleteMathFactsAssignment(id: number, userId: string): Promise<boolean>;

  // Site Settings (global - admin only)
  getSiteSettings(): Promise<SiteSetting[]>;
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  upsertSiteSetting(key: string, value: string | null): Promise<SiteSetting>;
  deleteSiteSetting(key: string): Promise<boolean>;

  // User Management (admin only)
  getAllUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllStudentsAdmin(): Promise<Student[]>;
  getStudentById(studentId: number): Promise<Student | undefined>;
  updateStudentPin(studentId: number, pin: string | null): Promise<Student | undefined>;
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
    
    // Get form content for language arts subjects with form level
    let formContentList: FormContent[] = [];
    if (subject.category === "language_arts" && subject.formLevel && subject.userId) {
      formContentList = await this.getFormContent(subject.userId, subject.formLevel);
    }
    
    // Create lessons with proper dates and link to form content
    // Calculate lessons per week based on scheduled days
    const lessonsPerWeek = scheduledDays.length;
    
    for (let i = 1; i <= lessonCount; i++) {
      // Calculate which week this lesson falls into (1-indexed)
      const weekNumber = Math.ceil(i / lessonsPerWeek);
      
      // Find matching form content by week number
      const matchingFormContent = formContentList.find(fc => fc.weekNumber === weekNumber);
      
      const lesson = {
        title: `${lessonPrefix} - Lesson ${i}`,
        content: `${curriculumSource} Grade ${grade}, Lesson ${i}`,
        subjectId: subjectId,
        dateScheduled: getNextScheduledDate(),
        formContentId: matchingFormContent?.id || null,
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
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
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
  async getAssignments(filters?: { lessonId?: number; studentId?: number; subjectId?: number; startDate?: string; endDate?: string }): Promise<Assignment[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return await db.select().from(assignments);
    }
    
    let conditions = [];
    
    if (filters.lessonId) {
      conditions.push(eq(assignments.lessonId, filters.lessonId));
    }
    
    if (filters.startDate) {
      conditions.push(gte(assignments.dueDate, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(assignments.dueDate, filters.endDate));
    }
    
    // For studentId and subjectId filters, we need to join with lessons and subjects
    if (filters.studentId || filters.subjectId) {
      // Get lessons that match the subject/student filter
      let lessonConditions = [];
      
      if (filters.subjectId) {
        lessonConditions.push(eq(lessons.subjectId, filters.subjectId));
      }
      
      if (filters.studentId) {
        // First get subjects for this student
        const studentSubjects = await db.select().from(subjects).where(eq(subjects.studentId, filters.studentId));
        const subjectIds = studentSubjects.map(s => s.id);
        if (subjectIds.length > 0) {
          lessonConditions.push(inArray(lessons.subjectId, subjectIds));
        } else {
          return []; // No subjects for this student
        }
      }
      
      const filteredLessons = await db.select().from(lessons).where(and(...lessonConditions));
      const lessonIds = filteredLessons.map(l => l.id);
      
      if (lessonIds.length > 0) {
        conditions.push(inArray(assignments.lessonId, lessonIds));
      } else {
        return []; // No lessons match filter
      }
    }
    
    if (conditions.length === 0) {
      return await db.select().from(assignments);
    }
    
    return await db.select().from(assignments).where(and(...conditions));
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

  // Lesson Resources
  async getLessonResources(lessonId?: number): Promise<LessonResource[]> {
    if (lessonId) {
      return await db.select().from(lessonResources).where(eq(lessonResources.lessonId, lessonId));
    }
    return await db.select().from(lessonResources);
  }

  async getLessonResource(id: number): Promise<LessonResource | undefined> {
    const [resource] = await db.select().from(lessonResources).where(eq(lessonResources.id, id));
    return resource;
  }

  async createLessonResource(resource: InsertLessonResource): Promise<LessonResource> {
    const [newResource] = await db.insert(lessonResources).values(resource).returning();
    return newResource;
  }

  async updateLessonResource(id: number, updates: UpdateLessonResourceRequest): Promise<LessonResource> {
    const [updatedResource] = await db.update(lessonResources).set(updates).where(eq(lessonResources.id, id)).returning();
    return updatedResource;
  }

  async deleteLessonResource(id: number): Promise<void> {
    await db.delete(lessonResources).where(eq(lessonResources.id, id));
  }

  // Form Content (Charlotte Mason custom curriculum)
  async getFormContent(userId: string, formLevel?: string): Promise<FormContent[]> {
    if (formLevel) {
      return await db.select().from(formContent)
        .where(and(eq(formContent.userId, userId), eq(formContent.formLevel, formLevel)))
        .orderBy(asc(formContent.weekNumber));
    }
    return await db.select().from(formContent)
      .where(eq(formContent.userId, userId))
      .orderBy(asc(formContent.formLevel), asc(formContent.weekNumber));
  }

  async getFormContentById(id: number, userId: string): Promise<FormContent | undefined> {
    const [content] = await db.select().from(formContent)
      .where(and(eq(formContent.id, id), eq(formContent.userId, userId)));
    return content;
  }

  async createFormContent(content: InsertFormContent): Promise<FormContent> {
    const [newContent] = await db.insert(formContent).values(content as any).returning();
    return newContent;
  }

  async updateFormContent(id: number, userId: string, updates: UpdateFormContentRequest): Promise<FormContent | undefined> {
    const [updatedContent] = await db.update(formContent)
      .set(updates)
      .where(and(eq(formContent.id, id), eq(formContent.userId, userId)))
      .returning();
    return updatedContent;
  }

  async deleteFormContent(id: number, userId: string): Promise<boolean> {
    await db.delete(formContent).where(and(eq(formContent.id, id), eq(formContent.userId, userId)));
    return true;
  }

  // Student Auth
  async verifyStudentPin(studentId: number, pin: string): Promise<Student | null> {
    const [student] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.pin, pin)));
    return student || null;
  }

  // Days Off
  async getDaysOff(userId: string): Promise<DayOff[]> {
    return await db.select().from(daysOff)
      .where(eq(daysOff.userId, userId))
      .orderBy(asc(daysOff.date));
  }

  async createDayOff(dayOff: InsertDayOffWithUser): Promise<DayOff> {
    const [newDayOff] = await db.insert(daysOff).values(dayOff as any).returning();
    return newDayOff;
  }

  async deleteDayOff(id: number, userId: string): Promise<boolean> {
    await db.delete(daysOff).where(and(eq(daysOff.id, id), eq(daysOff.userId, userId)));
    return true;
  }

  async bumpLessonsForDayOff(userId: string, dayOffDate: string): Promise<number> {
    // Get all subjects for the user
    const userSubjects = await db.select().from(subjects).where(eq(subjects.userId, userId));
    const subjectIds = userSubjects.map(s => s.id);
    
    if (subjectIds.length === 0) return 0;
    
    // Get all lessons on or after the day off date for these subjects
    const affectedLessons = await db.select().from(lessons)
      .where(and(
        inArray(lessons.subjectId, subjectIds),
        gte(lessons.dateScheduled, dayOffDate)
      ))
      .orderBy(asc(lessons.dateScheduled));
    
    if (affectedLessons.length === 0) return 0;
    
    // Get all days off for this user
    const allDaysOff = await db.select().from(daysOff).where(eq(daysOff.userId, userId));
    const daysOffSet = new Set(allDaysOff.map(d => d.date));
    
    let bumpedCount = 0;
    
    // Bump lessons that fall on the day off
    for (const lesson of affectedLessons) {
      if (lesson.dateScheduled === dayOffDate) {
        // Find the next valid school day
        const subject = userSubjects.find(s => s.id === lesson.subjectId);
        const scheduledDays = subject?.scheduledDays || [1, 2, 3, 4, 5];
        
        let newDate = new Date(lesson.dateScheduled + "T12:00:00Z");
        newDate.setDate(newDate.getDate() + 1);
        
        // Keep incrementing until we find a valid school day that's not a day off
        while (true) {
          const dayOfWeek = newDate.getDay();
          const dateStr = newDate.toISOString().split("T")[0];
          
          if (scheduledDays.includes(dayOfWeek) && !daysOffSet.has(dateStr)) {
            break;
          }
          newDate.setDate(newDate.getDate() + 1);
          
          // Safety: don't loop more than 365 days
          if (newDate.getTime() - new Date(lesson.dateScheduled).getTime() > 365 * 24 * 60 * 60 * 1000) {
            break;
          }
        }
        
        const newDateStr = newDate.toISOString().split("T")[0];
        
        await db.update(lessons)
          .set({ dateScheduled: newDateStr })
          .where(eq(lessons.id, lesson.id));
        
        // Also update the corresponding assignment due date
        await db.update(assignments)
          .set({ dueDate: newDateStr })
          .where(eq(assignments.lessonId, lesson.id));
        
        bumpedCount++;
      }
    }
    
    return bumpedCount;
  }

  // Curriculum Resources
  async getCurriculumResources(userId: string, filters?: { subject?: string; formLevel?: string; term?: string }): Promise<CurriculumResource[]> {
    let conditions = [eq(curriculumResources.userId, userId)];
    
    if (filters?.subject) {
      conditions.push(eq(curriculumResources.subject, filters.subject));
    }
    if (filters?.formLevel) {
      conditions.push(eq(curriculumResources.formLevel, filters.formLevel));
    }
    if (filters?.term) {
      conditions.push(eq(curriculumResources.term, filters.term));
    }
    
    return await db.select().from(curriculumResources)
      .where(and(...conditions))
      .orderBy(asc(curriculumResources.term), asc(curriculumResources.week), asc(curriculumResources.subject));
  }

  async getCurriculumResource(id: number, userId: string): Promise<CurriculumResource | undefined> {
    const [resource] = await db.select().from(curriculumResources)
      .where(and(eq(curriculumResources.id, id), eq(curriculumResources.userId, userId)));
    return resource;
  }

  async createCurriculumResource(resource: InsertCurriculumResourceWithUser): Promise<CurriculumResource> {
    const [newResource] = await db.insert(curriculumResources).values(resource as any).returning();
    return newResource;
  }

  async createCurriculumResourcesBulk(resources: InsertCurriculumResourceWithUser[]): Promise<CurriculumResource[]> {
    if (resources.length === 0) return [];
    const newResources = await db.insert(curriculumResources).values(resources as any).returning();
    return newResources;
  }

  async updateCurriculumResource(id: number, userId: string, updates: UpdateCurriculumResourceRequest): Promise<CurriculumResource | undefined> {
    const [updatedResource] = await db.update(curriculumResources)
      .set(updates)
      .where(and(eq(curriculumResources.id, id), eq(curriculumResources.userId, userId)))
      .returning();
    return updatedResource;
  }

  async deleteCurriculumResource(id: number, userId: string): Promise<boolean> {
    await db.delete(curriculumResources).where(and(eq(curriculumResources.id, id), eq(curriculumResources.userId, userId)));
    return true;
  }

  async deleteCurriculumResourcesBySubject(userId: string, subject: string): Promise<boolean> {
    await db.delete(curriculumResources).where(and(eq(curriculumResources.userId, userId), eq(curriculumResources.subject, subject)));
    return true;
  }

  // Math Facts Sessions
  async getMathFactsSessions(userId: string, studentId?: number, startDate?: Date, endDate?: Date): Promise<MathFactsSession[]> {
    const conditions = [eq(mathFactsSessions.userId, userId)];
    
    if (studentId) {
      conditions.push(eq(mathFactsSessions.studentId, studentId));
    }
    if (startDate) {
      conditions.push(gte(mathFactsSessions.completedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(mathFactsSessions.completedAt, endDate));
    }
    
    return await db.select().from(mathFactsSessions)
      .where(and(...conditions))
      .orderBy(asc(mathFactsSessions.completedAt));
  }

  async createMathFactsSession(session: InsertMathFactsSessionWithUser): Promise<MathFactsSession> {
    const [newSession] = await db.insert(mathFactsSessions).values(session as any).returning();
    return newSession;
  }

  // Student Logins (Attendance)
  async getStudentLogins(userId: string, studentId?: number, startDate?: Date, endDate?: Date): Promise<StudentLogin[]> {
    const conditions = [eq(studentLogins.userId, userId)];
    
    if (studentId) {
      conditions.push(eq(studentLogins.studentId, studentId));
    }
    if (startDate) {
      conditions.push(gte(studentLogins.loginAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(studentLogins.loginAt, endDate));
    }
    
    return await db.select().from(studentLogins)
      .where(and(...conditions))
      .orderBy(asc(studentLogins.loginAt));
  }

  async createStudentLogin(login: InsertStudentLoginWithUser): Promise<StudentLogin> {
    const [newLogin] = await db.insert(studentLogins).values(login as any).returning();
    return newLogin;
  }

  async updateStudentLogin(id: number, userId: string, updates: Partial<StudentLogin>): Promise<StudentLogin | undefined> {
    const [updatedLogin] = await db.update(studentLogins)
      .set(updates)
      .where(and(eq(studentLogins.id, id), eq(studentLogins.userId, userId)))
      .returning();
    return updatedLogin;
  }

  // Math Facts Assignments
  async getMathFactsAssignments(userId: string, studentId?: number): Promise<MathFactsAssignment[]> {
    const conditions = [eq(mathFactsAssignments.userId, userId)];
    
    if (studentId) {
      conditions.push(eq(mathFactsAssignments.studentId, studentId));
    }
    
    return await db.select().from(mathFactsAssignments)
      .where(and(...conditions))
      .orderBy(asc(mathFactsAssignments.dueDate));
  }

  async getMathFactsAssignment(id: number, userId: string): Promise<MathFactsAssignment | undefined> {
    const [assignment] = await db.select().from(mathFactsAssignments)
      .where(and(eq(mathFactsAssignments.id, id), eq(mathFactsAssignments.userId, userId)));
    return assignment;
  }

  async getMathFactsAssignmentsForStudent(studentId: number): Promise<MathFactsAssignment[]> {
    return await db.select().from(mathFactsAssignments)
      .where(eq(mathFactsAssignments.studentId, studentId))
      .orderBy(asc(mathFactsAssignments.dueDate));
  }

  async createMathFactsAssignment(assignment: InsertMathFactsAssignmentWithUser): Promise<MathFactsAssignment> {
    const [newAssignment] = await db.insert(mathFactsAssignments).values(assignment as any).returning();
    return newAssignment;
  }

  async updateMathFactsAssignment(id: number, userId: string, updates: Partial<MathFactsAssignment>): Promise<MathFactsAssignment | undefined> {
    const [updatedAssignment] = await db.update(mathFactsAssignments)
      .set(updates)
      .where(and(eq(mathFactsAssignments.id, id), eq(mathFactsAssignments.userId, userId)))
      .returning();
    return updatedAssignment;
  }

  async deleteMathFactsAssignment(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(mathFactsAssignments)
      .where(and(eq(mathFactsAssignments.id, id), eq(mathFactsAssignments.userId, userId)));
    return true;
  }

  // Site Settings (global - admin only)
  async getSiteSettings(): Promise<SiteSetting[]> {
    return await db.select().from(siteSettings);
  }

  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings)
      .where(eq(siteSettings.key, key));
    return setting;
  }

  async upsertSiteSetting(key: string, value: string | null): Promise<SiteSetting> {
    const existing = await this.getSiteSetting(key);
    if (existing) {
      const [updated] = await db.update(siteSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(siteSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteSettings)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  async deleteSiteSetting(key: string): Promise<boolean> {
    await db.delete(siteSettings)
      .where(eq(siteSettings.key, key));
    return true;
  }

  // User Management (admin only)
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getAllStudentsAdmin(): Promise<Student[]> {
    return await db.select().from(students).orderBy(students.name);
  }

  async getStudentById(studentId: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    return student;
  }

  async updateStudentPin(studentId: number, pin: string | null): Promise<Student | undefined> {
    const [updated] = await db.update(students)
      .set({ pin })
      .where(eq(students.id, studentId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
