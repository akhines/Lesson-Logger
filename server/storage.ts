import { db } from "./db";
import {
  subjects, lessons, assignments, students, lessonResources, formContent, daysOff, curriculumResources,
  mathFactsSessions, studentLogins, mathFactsAssignments, grammarAssignments, siteSettings, users, subjectStudents, libraryItems, pdfAnnotations,
  portfolioLabels, evidenceUploads, evidenceLabelLinks, readingProgress, portfolioShareTokens,
  siteSections, siteFeatures, sitePricingPlans, siteFaqs, siteTestimonials,
  organizations, orgMemberships, classes, classEnrollments, classLessons, teacherFeedback,
  insertDayOffSchemaWithUser, insertCurriculumResourceSchemaWithUser,
  insertMathFactsSessionSchemaWithUser, insertStudentLoginSchemaWithUser, insertMathFactsAssignmentSchemaWithUser,
  insertGrammarAssignmentSchemaWithUser, insertLibraryItemSchemaWithUser, insertReadingProgressSchemaWithStudent,
  insertPortfolioLabelSchemaWithUser, insertEvidenceUploadSchemaWithUser,
  type Subject, type InsertSubject, type UpdateSubjectRequest,
  type Lesson, type InsertLesson, type UpdateLessonRequest,
  type Assignment, type InsertAssignment, type UpdateAssignmentRequest,
  type Student, type InsertStudent, type UpdateStudentRequest,
  type LessonResource, type InsertLessonResource, type UpdateLessonResourceRequest,
  type FormContent, type InsertFormContent, type UpdateFormContentRequest,
  type DayOff, type UpdateDayOffRequest,
  type CurriculumResource, type UpdateCurriculumResourceRequest,
  type MathFactsSession, type StudentLogin, type MathFactsAssignment, type GrammarAssignment, type SiteSetting, type User,
  type SubjectStudent, type LibraryItem, type UpdateLibraryItemRequest,
  type PdfAnnotation, type InsertPdfAnnotation,
  type PortfolioLabel, type UpdatePortfolioLabelRequest,
  type EvidenceUpload, type UpdateEvidenceUploadRequest,
  type ReadingProgress, type InsertReadingProgress,
  type PortfolioShareToken,
  type SiteSection, type InsertSiteSection,
  type SiteFeature, type InsertSiteFeature,
  type SitePricingPlan, type InsertSitePricingPlan,
  type SiteFaq, type InsertSiteFaq,
  type SiteTestimonial, type InsertSiteTestimonial,
  type Organization, type InsertOrganization,
  type OrgMembership, type InsertOrgMembership,
  type Class, type InsertClass,
  type ClassEnrollment, type InsertClassEnrollment,
  type ClassLesson, type InsertClassLesson,
  type TeacherFeedback, type InsertTeacherFeedback,
  type OrgRole,
  lessonLogs,
  type LessonLog, type InsertLessonLog
} from "@shared/schema";
import { z } from "zod";

type InsertDayOffWithUser = z.infer<typeof insertDayOffSchemaWithUser>;
type InsertCurriculumResourceWithUser = z.infer<typeof insertCurriculumResourceSchemaWithUser>;
type InsertMathFactsSessionWithUser = z.infer<typeof insertMathFactsSessionSchemaWithUser>;
type InsertPortfolioLabelWithUser = z.infer<typeof insertPortfolioLabelSchemaWithUser>;
type InsertEvidenceUploadWithUser = z.infer<typeof insertEvidenceUploadSchemaWithUser>;
type InsertStudentLoginWithUser = z.infer<typeof insertStudentLoginSchemaWithUser>;
type InsertMathFactsAssignmentWithUser = z.infer<typeof insertMathFactsAssignmentSchemaWithUser>;
type InsertGrammarAssignmentWithUser = z.infer<typeof insertGrammarAssignmentSchemaWithUser>;
type InsertLibraryItemWithUser = z.infer<typeof insertLibraryItemSchemaWithUser>;
import { eq, and, gte, lte, inArray, asc, desc } from "drizzle-orm";

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

  // Grammar Assignments
  getGrammarAssignments(userId: string, studentId?: number): Promise<GrammarAssignment[]>;
  getGrammarAssignmentsForStudent(studentId: number): Promise<GrammarAssignment[]>;
  createGrammarAssignment(assignment: InsertGrammarAssignmentWithUser): Promise<GrammarAssignment>;
  updateGrammarAssignment(id: number, userId: string, updates: Partial<GrammarAssignment>): Promise<GrammarAssignment | undefined>;
  deleteGrammarAssignment(id: number, userId: string): Promise<boolean>;

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

  // Subject-Student relationships
  getSubjectStudents(subjectId: number): Promise<Student[]>;
  setSubjectStudents(subjectId: number, studentIds: number[]): Promise<void>;
  getSubjectsForStudent(studentId: number): Promise<Subject[]>;

  // Library Items
  getLibraryItems(userId: string, filters?: { type?: string; mediaType?: string; source?: string }): Promise<LibraryItem[]>;
  getLibraryItem(id: number, userId: string): Promise<LibraryItem | undefined>;
  createLibraryItem(item: InsertLibraryItemWithUser): Promise<LibraryItem>;
  updateLibraryItem(id: number, userId: string, updates: UpdateLibraryItemRequest): Promise<LibraryItem | undefined>;
  deleteLibraryItem(id: number, userId: string): Promise<boolean>;
  getLibraryItemBySourceId(userId: string, source: string, sourceId: string): Promise<LibraryItem | undefined>;

  // PDF Annotations
  getPdfAnnotations(lessonId: number, studentId: number): Promise<PdfAnnotation[]>;
  createPdfAnnotation(annotation: InsertPdfAnnotation): Promise<PdfAnnotation>;
  updatePdfAnnotation(id: number, studentId: number, updates: Partial<InsertPdfAnnotation>): Promise<PdfAnnotation | undefined>;
  deletePdfAnnotation(id: number, studentId: number): Promise<boolean>;
  savePdfAnnotations(lessonId: number, studentId: number, annotations: InsertPdfAnnotation[]): Promise<PdfAnnotation[]>;

  // Reading Progress (student book reading progress)
  getReadingProgressForStudent(studentId: number): Promise<ReadingProgress[]>;
  getReadingProgress(studentId: number, gutenbergId: number): Promise<ReadingProgress | undefined>;
  upsertReadingProgress(data: InsertReadingProgress): Promise<ReadingProgress>;
  deleteReadingProgress(studentId: number, gutenbergId: number): Promise<boolean>;

  // Portfolio Labels
  getPortfolioLabels(userId: string, subjectId?: number): Promise<PortfolioLabel[]>;
  getPortfolioLabel(id: number, userId: string): Promise<PortfolioLabel | undefined>;
  createPortfolioLabel(label: InsertPortfolioLabelWithUser): Promise<PortfolioLabel>;
  updatePortfolioLabel(id: number, userId: string, updates: UpdatePortfolioLabelRequest): Promise<PortfolioLabel | undefined>;
  deletePortfolioLabel(id: number, userId: string): Promise<boolean>;

  // Lesson Logs
  getLessonLogs(userId: string, filters?: { studentId?: number; startDate?: string; endDate?: string; subjectName?: string; tag?: string }): Promise<LessonLog[]>;
  getLessonLog(id: number, userId: string): Promise<LessonLog | undefined>;
  createLessonLog(log: InsertLessonLog): Promise<LessonLog>;
  updateLessonLog(id: number, userId: string, updates: Partial<InsertLessonLog>): Promise<LessonLog | undefined>;
  deleteLessonLog(id: number, userId: string): Promise<boolean>;

  // Evidence Uploads
  getEvidenceUploads(userId: string, filters?: { studentId?: number; lessonId?: number; reviewStatus?: string }): Promise<EvidenceUpload[]>;
  getEvidenceUpload(id: number, userId: string): Promise<EvidenceUpload | undefined>;
  createEvidenceUpload(evidence: InsertEvidenceUploadWithUser): Promise<EvidenceUpload>;
  updateEvidenceUpload(id: number, userId: string, updates: UpdateEvidenceUploadRequest): Promise<EvidenceUpload | undefined>;
  deleteEvidenceUpload(id: number, userId: string): Promise<boolean>;
  getEvidenceForLesson(lessonId: number, studentId: number): Promise<EvidenceUpload[]>;
  getPendingReviewCount(userId: string): Promise<number>;

  // Evidence Labels (many-to-many)
  getEvidenceLabels(evidenceId: number): Promise<PortfolioLabel[]>;
  setEvidenceLabels(evidenceId: number, labelIds: number[]): Promise<void>;
  assignEvidenceLabel(evidenceId: number, labelId: number): Promise<void>;

  // Portfolio Share Tokens (for public portfolio viewing)
  getOrCreatePortfolioShareToken(studentId: number, userId: string): Promise<PortfolioShareToken>;
  getPortfolioByShareToken(token: string): Promise<{
    student: Student;
    evidence: Array<EvidenceUpload & { labels: PortfolioLabel[] }>;
    labels: PortfolioLabel[];
  } | null>;

  // Site Sections (CMS homepage blocks)
  getSiteSections(): Promise<SiteSection[]>;
  getSiteSection(id: number): Promise<SiteSection | undefined>;
  createSiteSection(section: InsertSiteSection): Promise<SiteSection>;
  updateSiteSection(id: number, updates: Partial<InsertSiteSection>): Promise<SiteSection | undefined>;
  deleteSiteSection(id: number): Promise<boolean>;
  reorderSiteSections(sectionIds: number[]): Promise<void>;

  // Site Features (CMS)
  getSiteFeatures(): Promise<SiteFeature[]>;
  getSiteFeature(id: number): Promise<SiteFeature | undefined>;
  createSiteFeature(feature: InsertSiteFeature): Promise<SiteFeature>;
  updateSiteFeature(id: number, updates: Partial<InsertSiteFeature>): Promise<SiteFeature | undefined>;
  deleteSiteFeature(id: number): Promise<boolean>;

  // Site Pricing Plans (CMS)
  getSitePricingPlans(): Promise<SitePricingPlan[]>;
  getSitePricingPlan(id: number): Promise<SitePricingPlan | undefined>;
  createSitePricingPlan(plan: InsertSitePricingPlan): Promise<SitePricingPlan>;
  updateSitePricingPlan(id: number, updates: Partial<InsertSitePricingPlan>): Promise<SitePricingPlan | undefined>;
  deleteSitePricingPlan(id: number): Promise<boolean>;

  // Site FAQs (CMS)
  getSiteFaqs(): Promise<SiteFaq[]>;
  getSiteFaq(id: number): Promise<SiteFaq | undefined>;
  createSiteFaq(faq: InsertSiteFaq): Promise<SiteFaq>;
  updateSiteFaq(id: number, updates: Partial<InsertSiteFaq>): Promise<SiteFaq | undefined>;
  deleteSiteFaq(id: number): Promise<boolean>;

  // Site Testimonials (CMS)
  getSiteTestimonials(): Promise<SiteTestimonial[]>;
  getSiteTestimonial(id: number): Promise<SiteTestimonial | undefined>;
  createSiteTestimonial(testimonial: InsertSiteTestimonial): Promise<SiteTestimonial>;
  updateSiteTestimonial(id: number, updates: Partial<InsertSiteTestimonial>): Promise<SiteTestimonial | undefined>;
  deleteSiteTestimonial(id: number): Promise<boolean>;

  // Organizations (Co-ops)
  getOrganizations(userId: string): Promise<Organization[]>;
  getOrganization(id: number, userId: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization, ownerId: string): Promise<Organization>;
  updateOrganization(id: number, userId: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number, userId: string): Promise<boolean>;

  // Org Memberships
  getOrgMemberships(organizationId: number): Promise<(OrgMembership & { user?: User })[]>;
  getOrgMembership(organizationId: number, userId: string): Promise<OrgMembership | undefined>;
  getUserOrgMemberships(userId: string): Promise<(OrgMembership & { organization: Organization })[]>;
  createOrgMembership(membership: InsertOrgMembership): Promise<OrgMembership>;
  updateOrgMembership(id: number, updates: Partial<InsertOrgMembership>): Promise<OrgMembership | undefined>;
  deleteOrgMembership(id: number): Promise<boolean>;
  getUserRoleInOrg(userId: string, organizationId: number): Promise<OrgRole | null>;
  isUserInCoopAccount(userId: string): Promise<boolean>;

  // Classes
  getClasses(organizationId: number): Promise<Class[]>;
  getClassesForTeacher(teacherUserId: string): Promise<Class[]>;
  getClass(id: number): Promise<Class | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: number, updates: Partial<InsertClass>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;

  // Class Enrollments
  getClassEnrollments(classId: number): Promise<(ClassEnrollment & { student: Student })[]>;
  getStudentEnrollments(studentId: number): Promise<(ClassEnrollment & { class: Class })[]>;
  enrollStudent(classId: number, studentId: number): Promise<ClassEnrollment>;
  unenrollStudent(classId: number, studentId: number): Promise<boolean>;
  
  // Permission Helpers
  getAccessibleStudentIds(userId: string, organizationId?: number): Promise<number[]>;
  canAccessStudent(userId: string, studentId: number): Promise<boolean>;
  canAccessLesson(userId: string, lessonId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Students
  async getStudents(userId: string): Promise<Student[]> {
    // Use the permission system to get accessible student IDs
    const accessibleIds = await this.getAccessibleStudentIds(userId);
    
    if (accessibleIds.length === 0) {
      return [];
    }
    
    return await db.select().from(students).where(inArray(students.id, accessibleIds));
  }

  async getStudent(id: number, userId: string): Promise<Student | undefined> {
    // Use the permission system to check access
    const canAccess = await this.canAccessStudent(userId, id);
    if (!canAccess) return undefined;
    
    const [student] = await db.select().from(students).where(eq(students.id, id));
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
    // Get accessible student IDs for permission-based filtering
    const accessibleStudentIds = await this.getAccessibleStudentIds(userId);
    
    // Get subjects owned by user
    const ownedSubjects = await db.select().from(subjects).where(eq(subjects.userId, userId));
    
    // Get subjects assigned to accessible students
    if (accessibleStudentIds.length > 0) {
      const studentSubjectLinks = await db.select({ subjectId: subjectStudents.subjectId })
        .from(subjectStudents)
        .where(inArray(subjectStudents.studentId, accessibleStudentIds));
      
      const linkedSubjectIds = studentSubjectLinks.map(s => s.subjectId);
      if (linkedSubjectIds.length > 0) {
        const linkedSubjects = await db.select().from(subjects)
          .where(inArray(subjects.id, linkedSubjectIds));
        
        // Combine and deduplicate
        const allSubjects = [...ownedSubjects];
        const existingIds = new Set(ownedSubjects.map(s => s.id));
        linkedSubjects.forEach(s => {
          if (!existingIds.has(s.id)) {
            allSubjects.push(s);
          }
        });
        return allSubjects;
      }
    }
    
    return ownedSubjects;
  }

  async getSubject(id: number, userId: string): Promise<Subject | undefined> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    if (!subject) return undefined;
    
    // Check ownership
    if (subject.userId === userId) return subject;
    
    // Check if user can access via teacher class
    if (subject.classId) {
      const classData = await this.getClass(subject.classId);
      if (classData?.teacherUserId === userId) return subject;
    }
    
    // Check if user has access to any student assigned to this subject
    const studentLinks = await db.select({ studentId: subjectStudents.studentId })
      .from(subjectStudents)
      .where(eq(subjectStudents.subjectId, id));
    
    for (const link of studentLinks) {
      if (await this.canAccessStudent(userId, link.studentId)) {
        return subject;
      }
    }
    
    return undefined;
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
    // First verify the subject belongs to this user
    const [subject] = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
    if (!subject) return false;
    
    // Get all lessons for this subject
    const subjectLessons = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.subjectId, id));
    if (subjectLessons.length > 0) {
      const lessonIds = subjectLessons.map(l => l.id);
      // Delete lesson resources for lessons in this subject
      await db.delete(lessonResources).where(inArray(lessonResources.lessonId, lessonIds));
      // Delete assignments for lessons in this subject
      await db.delete(assignments).where(inArray(assignments.lessonId, lessonIds));
    }
    
    // Delete lessons for this subject
    await db.delete(lessons).where(eq(lessons.subjectId, id));
    
    // Delete subject_students entries (should cascade, but be explicit)
    await db.delete(subjectStudents).where(eq(subjectStudents.subjectId, id));
    
    // Now delete the subject
    await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, userId)));
    return true;
  }

  async generateLessonsFromCurriculum(subjectId: number, curriculumSource: string): Promise<void> {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
    if (!subject) return;

    const grade = subject.gradeLevel || "K";
    const scheduledDays = subject.scheduledDays || [1, 2, 3, 4, 5];
    const startLesson = subject.startLesson || 1; // Support starting at a specific lesson number
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
    
    // Start from the specified lesson number and go up to total lessons
    for (let i = startLesson; i <= lessonCount; i++) {
      // Calculate which week this lesson falls into (1-indexed), adjusted for start lesson
      const lessonIndex = i - startLesson + 1; // Lesson position from start (1, 2, 3...)
      const weekNumber = Math.ceil(lessonIndex / lessonsPerWeek);
      
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
      // Delete related records first to avoid foreign key constraint errors
      await db.delete(assignments).where(eq(assignments.lessonId, id));
      await db.delete(lessonResources).where(eq(lessonResources.lessonId, id));
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

  // Grammar Assignments
  async getGrammarAssignments(userId: string, studentId?: number): Promise<GrammarAssignment[]> {
    const conditions = [eq(grammarAssignments.userId, userId)];
    
    if (studentId) {
      conditions.push(eq(grammarAssignments.studentId, studentId));
    }
    
    return await db.select().from(grammarAssignments)
      .where(and(...conditions))
      .orderBy(asc(grammarAssignments.dueDate));
  }

  async getGrammarAssignmentsForStudent(studentId: number): Promise<GrammarAssignment[]> {
    return await db.select().from(grammarAssignments)
      .where(eq(grammarAssignments.studentId, studentId))
      .orderBy(asc(grammarAssignments.dueDate));
  }

  async createGrammarAssignment(assignment: InsertGrammarAssignmentWithUser): Promise<GrammarAssignment> {
    const [newAssignment] = await db.insert(grammarAssignments).values(assignment as any).returning();
    return newAssignment;
  }

  async updateGrammarAssignment(id: number, userId: string, updates: Partial<GrammarAssignment>): Promise<GrammarAssignment | undefined> {
    const [updatedAssignment] = await db.update(grammarAssignments)
      .set(updates)
      .where(and(eq(grammarAssignments.id, id), eq(grammarAssignments.userId, userId)))
      .returning();
    return updatedAssignment;
  }

  async deleteGrammarAssignment(id: number, userId: string): Promise<boolean> {
    await db.delete(grammarAssignments)
      .where(and(eq(grammarAssignments.id, id), eq(grammarAssignments.userId, userId)));
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

  // Subject-Student relationships
  async getSubjectStudents(subjectId: number): Promise<Student[]> {
    const rows = await db.select({ student: students })
      .from(subjectStudents)
      .innerJoin(students, eq(subjectStudents.studentId, students.id))
      .where(eq(subjectStudents.subjectId, subjectId));
    return rows.map(r => r.student);
  }

  async setSubjectStudents(subjectId: number, studentIds: number[]): Promise<void> {
    // Delete existing relationships
    await db.delete(subjectStudents).where(eq(subjectStudents.subjectId, subjectId));
    
    // Insert new relationships
    if (studentIds.length > 0) {
      await db.insert(subjectStudents).values(
        studentIds.map(studentId => ({ subjectId, studentId }))
      );
    }
  }

  async getSubjectsForStudent(studentId: number): Promise<Subject[]> {
    const rows = await db.select({ subject: subjects })
      .from(subjectStudents)
      .innerJoin(subjects, eq(subjectStudents.subjectId, subjects.id))
      .where(eq(subjectStudents.studentId, studentId));
    return rows.map(r => r.subject);
  }

  // Library Items
  async getLibraryItems(userId: string, filters?: { type?: string; mediaType?: string; source?: string }): Promise<LibraryItem[]> {
    const conditions = [eq(libraryItems.userId, userId)];
    if (filters?.type) conditions.push(eq(libraryItems.type, filters.type));
    if (filters?.mediaType) conditions.push(eq(libraryItems.mediaType, filters.mediaType));
    if (filters?.source) conditions.push(eq(libraryItems.source, filters.source));
    return await db.select().from(libraryItems).where(and(...conditions)).orderBy(libraryItems.title);
  }

  async getLibraryItem(id: number, userId: string): Promise<LibraryItem | undefined> {
    const [item] = await db.select().from(libraryItems)
      .where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)));
    return item;
  }

  async createLibraryItem(item: InsertLibraryItemWithUser): Promise<LibraryItem> {
    const [created] = await db.insert(libraryItems).values(item).returning();
    return created;
  }

  async updateLibraryItem(id: number, userId: string, updates: UpdateLibraryItemRequest): Promise<LibraryItem | undefined> {
    const [updated] = await db.update(libraryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)))
      .returning();
    return updated;
  }

  async deleteLibraryItem(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(libraryItems)
      .where(and(eq(libraryItems.id, id), eq(libraryItems.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getLibraryItemBySourceId(userId: string, source: string, sourceId: string): Promise<LibraryItem | undefined> {
    const [item] = await db.select().from(libraryItems)
      .where(and(
        eq(libraryItems.userId, userId),
        eq(libraryItems.source, source),
        eq(libraryItems.sourceId, sourceId)
      ));
    return item;
  }

  // Reading Progress
  async getReadingProgressForStudent(studentId: number): Promise<ReadingProgress[]> {
    return await db.select().from(readingProgress)
      .where(eq(readingProgress.studentId, studentId))
      .orderBy(readingProgress.lastReadAt);
  }

  async getReadingProgress(studentId: number, gutenbergId: number): Promise<ReadingProgress | undefined> {
    const [progress] = await db.select().from(readingProgress)
      .where(and(
        eq(readingProgress.studentId, studentId),
        eq(readingProgress.gutenbergId, gutenbergId)
      ));
    return progress;
  }

  async upsertReadingProgress(data: InsertReadingProgress): Promise<ReadingProgress> {
    // Check if progress already exists
    const existing = await this.getReadingProgress(data.studentId, data.gutenbergId);
    if (existing) {
      // Update existing progress
      const [updated] = await db.update(readingProgress)
        .set({
          ...data,
          lastReadAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new progress
      const [created] = await db.insert(readingProgress)
        .values({
          ...data,
          startedAt: new Date(),
          lastReadAt: new Date(),
        })
        .returning();
      return created;
    }
  }

  async deleteReadingProgress(studentId: number, gutenbergId: number): Promise<boolean> {
    const result = await db.delete(readingProgress)
      .where(and(
        eq(readingProgress.studentId, studentId),
        eq(readingProgress.gutenbergId, gutenbergId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // PDF Annotations
  async getPdfAnnotations(lessonId: number, studentId: number): Promise<PdfAnnotation[]> {
    return await db.select().from(pdfAnnotations)
      .where(and(
        eq(pdfAnnotations.lessonId, lessonId),
        eq(pdfAnnotations.studentId, studentId)
      ));
  }

  async createPdfAnnotation(annotation: InsertPdfAnnotation): Promise<PdfAnnotation> {
    const [created] = await db.insert(pdfAnnotations).values(annotation as any).returning();
    return created;
  }

  async updatePdfAnnotation(id: number, studentId: number, updates: Partial<InsertPdfAnnotation>): Promise<PdfAnnotation | undefined> {
    const [updated] = await db.update(pdfAnnotations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(pdfAnnotations.id, id), eq(pdfAnnotations.studentId, studentId)))
      .returning();
    return updated;
  }

  async deletePdfAnnotation(id: number, studentId: number): Promise<boolean> {
    const result = await db.delete(pdfAnnotations)
      .where(and(eq(pdfAnnotations.id, id), eq(pdfAnnotations.studentId, studentId)));
    return (result.rowCount ?? 0) > 0;
  }

  async savePdfAnnotations(lessonId: number, studentId: number, annotations: InsertPdfAnnotation[]): Promise<PdfAnnotation[]> {
    // Delete existing annotations for this lesson/student
    await db.delete(pdfAnnotations)
      .where(and(
        eq(pdfAnnotations.lessonId, lessonId),
        eq(pdfAnnotations.studentId, studentId)
      ));
    
    // Insert new annotations
    if (annotations.length === 0) {
      return [];
    }
    
    const created = await db.insert(pdfAnnotations)
      .values(annotations.map(a => ({ ...a, lessonId, studentId })) as any)
      .returning();
    return created;
  }

  // Portfolio Labels
  async getPortfolioLabels(userId: string, subjectId?: number): Promise<PortfolioLabel[]> {
    if (subjectId) {
      return await db.select().from(portfolioLabels)
        .where(and(eq(portfolioLabels.userId, userId), eq(portfolioLabels.subjectId, subjectId)));
    }
    return await db.select().from(portfolioLabels).where(eq(portfolioLabels.userId, userId));
  }

  async getPortfolioLabel(id: number, userId: string): Promise<PortfolioLabel | undefined> {
    const [label] = await db.select().from(portfolioLabels)
      .where(and(eq(portfolioLabels.id, id), eq(portfolioLabels.userId, userId)));
    return label;
  }

  async createPortfolioLabel(label: InsertPortfolioLabelWithUser): Promise<PortfolioLabel> {
    const [created] = await db.insert(portfolioLabels).values(label as any).returning();
    return created;
  }

  async updatePortfolioLabel(id: number, userId: string, updates: UpdatePortfolioLabelRequest): Promise<PortfolioLabel | undefined> {
    const [updated] = await db.update(portfolioLabels)
      .set(updates)
      .where(and(eq(portfolioLabels.id, id), eq(portfolioLabels.userId, userId)))
      .returning();
    return updated;
  }

  async deletePortfolioLabel(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(portfolioLabels)
      .where(and(eq(portfolioLabels.id, id), eq(portfolioLabels.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Lesson Logs
  async getLessonLogs(userId: string, filters?: { studentId?: number; startDate?: string; endDate?: string; subjectName?: string; tag?: string }): Promise<LessonLog[]> {
    let conditions: any[] = [eq(lessonLogs.userId, userId)];
    if (filters?.studentId) {
      conditions.push(eq(lessonLogs.studentId, filters.studentId));
    }
    if (filters?.startDate) {
      conditions.push(gte(lessonLogs.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(lessonLogs.date, filters.endDate));
    }
    if (filters?.subjectName) {
      conditions.push(eq(lessonLogs.subjectName, filters.subjectName));
    }
    return await db.select().from(lessonLogs).where(and(...conditions)).orderBy(desc(lessonLogs.date), desc(lessonLogs.createdAt));
  }

  async getLessonLog(id: number, userId: string): Promise<LessonLog | undefined> {
    const [log] = await db.select().from(lessonLogs).where(and(eq(lessonLogs.id, id), eq(lessonLogs.userId, userId)));
    return log;
  }

  async createLessonLog(log: InsertLessonLog): Promise<LessonLog> {
    const [created] = await db.insert(lessonLogs).values(log as any).returning();
    return created;
  }

  async updateLessonLog(id: number, userId: string, updates: Partial<InsertLessonLog>): Promise<LessonLog | undefined> {
    const [updated] = await db.update(lessonLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(lessonLogs.id, id), eq(lessonLogs.userId, userId)))
      .returning();
    return updated;
  }

  async deleteLessonLog(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(lessonLogs)
      .where(and(eq(lessonLogs.id, id), eq(lessonLogs.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Evidence Uploads
  async getEvidenceUploads(userId: string, filters?: { studentId?: number; lessonId?: number; reviewStatus?: string }): Promise<EvidenceUpload[]> {
    // Get accessible student IDs for this user (includes owned + teacher access)
    const accessibleStudentIds = await this.getAccessibleStudentIds(userId);
    
    if (accessibleStudentIds.length === 0) {
      return [];
    }
    
    let conditions: any[] = [inArray(evidenceUploads.studentId, accessibleStudentIds)];
    
    if (filters?.studentId) {
      // Verify the requested studentId is accessible
      if (!accessibleStudentIds.includes(filters.studentId)) {
        return [];
      }
      conditions.push(eq(evidenceUploads.studentId, filters.studentId));
    }
    if (filters?.lessonId) {
      conditions.push(eq(evidenceUploads.lessonId, filters.lessonId));
    }
    if (filters?.reviewStatus) {
      conditions.push(eq(evidenceUploads.reviewStatus, filters.reviewStatus));
    }
    return await db.select().from(evidenceUploads).where(and(...conditions));
  }

  // Internal helper: get evidence by ID without access check (for permission validation)
  async getEvidenceUploadById(id: number): Promise<EvidenceUpload | undefined> {
    const [evidence] = await db.select().from(evidenceUploads).where(eq(evidenceUploads.id, id));
    return evidence;
  }

  async getEvidenceUpload(id: number, userId: string): Promise<EvidenceUpload | undefined> {
    const evidence = await this.getEvidenceUploadById(id);
    if (!evidence) return undefined;
    
    // Verify user can access this student
    const canAccess = await this.canAccessStudent(userId, evidence.studentId);
    if (!canAccess) return undefined;
    
    return evidence;
  }

  async createEvidenceUpload(evidence: InsertEvidenceUploadWithUser): Promise<EvidenceUpload> {
    const [created] = await db.insert(evidenceUploads).values(evidence as any).returning();
    return created;
  }

  async updateEvidenceUpload(id: number, userId: string, updates: UpdateEvidenceUploadRequest): Promise<EvidenceUpload | undefined> {
    const [updated] = await db.update(evidenceUploads)
      .set(updates)
      .where(and(eq(evidenceUploads.id, id), eq(evidenceUploads.userId, userId)))
      .returning();
    return updated;
  }

  async deleteEvidenceUpload(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(evidenceUploads)
      .where(and(eq(evidenceUploads.id, id), eq(evidenceUploads.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getEvidenceForLesson(lessonId: number, studentId: number): Promise<EvidenceUpload[]> {
    return await db.select().from(evidenceUploads)
      .where(and(
        eq(evidenceUploads.lessonId, lessonId),
        eq(evidenceUploads.studentId, studentId)
      ));
  }

  async getPendingReviewCount(userId: string): Promise<number> {
    // Get accessible student IDs for this user
    const accessibleStudentIds = await this.getAccessibleStudentIds(userId);
    if (accessibleStudentIds.length === 0) return 0;
    
    const result = await db.select().from(evidenceUploads)
      .where(and(
        inArray(evidenceUploads.studentId, accessibleStudentIds),
        eq(evidenceUploads.reviewStatus, "pending")
      ));
    return result.length;
  }

  // Evidence Labels (many-to-many)
  async getEvidenceLabels(evidenceId: number): Promise<PortfolioLabel[]> {
    const links = await db.select().from(evidenceLabelLinks)
      .where(eq(evidenceLabelLinks.evidenceId, evidenceId));
    if (links.length === 0) return [];
    
    const labelIds = links.map(l => l.labelId);
    return await db.select().from(portfolioLabels)
      .where(inArray(portfolioLabels.id, labelIds));
  }

  async setEvidenceLabels(evidenceId: number, labelIds: number[]): Promise<void> {
    // Delete existing links
    await db.delete(evidenceLabelLinks)
      .where(eq(evidenceLabelLinks.evidenceId, evidenceId));
    
    // Insert new links
    if (labelIds.length > 0) {
      await db.insert(evidenceLabelLinks)
        .values(labelIds.map(labelId => ({ evidenceId, labelId })));
    }
  }

  async assignEvidenceLabel(evidenceId: number, labelId: number): Promise<void> {
    // Add a single label to evidence (doesn't remove existing)
    try {
      await db.insert(evidenceLabelLinks)
        .values({ evidenceId, labelId })
        .onConflictDoNothing();
    } catch {
      // Ignore duplicate errors
    }
  }

  // ============ Portfolio Share Tokens ============
  async getOrCreatePortfolioShareToken(studentId: number, userId: string): Promise<PortfolioShareToken> {
    // Check if token exists
    const [existing] = await db.select().from(portfolioShareTokens)
      .where(and(
        eq(portfolioShareTokens.studentId, studentId),
        eq(portfolioShareTokens.userId, userId)
      ));
    
    if (existing) return existing;
    
    // Create new token
    const { randomUUID } = await import('crypto');
    const token = randomUUID();
    const [created] = await db.insert(portfolioShareTokens)
      .values({ studentId, userId, token })
      .returning();
    return created;
  }

  async getPortfolioByShareToken(token: string): Promise<{
    student: Student;
    evidence: Array<EvidenceUpload & { labels: PortfolioLabel[] }>;
    labels: PortfolioLabel[];
  } | null> {
    // Find the token
    const [shareToken] = await db.select().from(portfolioShareTokens)
      .where(eq(portfolioShareTokens.token, token));
    
    if (!shareToken) return null;
    
    // Check expiration if set
    if (shareToken.expiresAt && new Date(shareToken.expiresAt) < new Date()) {
      return null;
    }
    
    // Get student
    const [student] = await db.select().from(students)
      .where(eq(students.id, shareToken.studentId));
    
    if (!student) return null;
    
    // Get all approved evidence for this student
    const evidence = await db.select().from(evidenceUploads)
      .where(and(
        eq(evidenceUploads.studentId, shareToken.studentId),
        eq(evidenceUploads.reviewStatus, 'approved')
      ));
    
    // Get all labels for the user
    const labels = await db.select().from(portfolioLabels)
      .where(eq(portfolioLabels.userId, shareToken.userId));
    
    // Fetch labels for each evidence item
    const evidenceWithLabels = await Promise.all(
      evidence.map(async (e) => {
        const eLabels = await this.getEvidenceLabels(e.id);
        return { ...e, labels: eLabels };
      })
    );
    
    return { student, evidence: evidenceWithLabels, labels };
  }

  // ============ CMS Site Sections ============
  async getSiteSections(): Promise<SiteSection[]> {
    return await db.select().from(siteSections).orderBy(asc(siteSections.sortOrder));
  }

  async getSiteSection(id: number): Promise<SiteSection | undefined> {
    const [section] = await db.select().from(siteSections).where(eq(siteSections.id, id));
    return section;
  }

  async createSiteSection(section: InsertSiteSection): Promise<SiteSection> {
    const [created] = await db.insert(siteSections).values(section).returning();
    return created;
  }

  async updateSiteSection(id: number, updates: Partial<InsertSiteSection>): Promise<SiteSection | undefined> {
    const [updated] = await db.update(siteSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteSections.id, id))
      .returning();
    return updated;
  }

  async deleteSiteSection(id: number): Promise<boolean> {
    const result = await db.delete(siteSections).where(eq(siteSections.id, id));
    return true;
  }

  async reorderSiteSections(sectionIds: number[]): Promise<void> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(siteSections)
        .set({ sortOrder: i })
        .where(eq(siteSections.id, sectionIds[i]));
    }
  }

  // ============ CMS Site Features ============
  async getSiteFeatures(): Promise<SiteFeature[]> {
    return await db.select().from(siteFeatures).orderBy(asc(siteFeatures.sortOrder));
  }

  async getSiteFeature(id: number): Promise<SiteFeature | undefined> {
    const [feature] = await db.select().from(siteFeatures).where(eq(siteFeatures.id, id));
    return feature;
  }

  async createSiteFeature(feature: InsertSiteFeature): Promise<SiteFeature> {
    const [created] = await db.insert(siteFeatures).values(feature).returning();
    return created;
  }

  async updateSiteFeature(id: number, updates: Partial<InsertSiteFeature>): Promise<SiteFeature | undefined> {
    const [updated] = await db.update(siteFeatures)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteFeatures.id, id))
      .returning();
    return updated;
  }

  async deleteSiteFeature(id: number): Promise<boolean> {
    await db.delete(siteFeatures).where(eq(siteFeatures.id, id));
    return true;
  }

  // ============ CMS Site Pricing Plans ============
  async getSitePricingPlans(): Promise<SitePricingPlan[]> {
    return await db.select().from(sitePricingPlans).orderBy(asc(sitePricingPlans.sortOrder));
  }

  async getSitePricingPlan(id: number): Promise<SitePricingPlan | undefined> {
    const [plan] = await db.select().from(sitePricingPlans).where(eq(sitePricingPlans.id, id));
    return plan;
  }

  async createSitePricingPlan(plan: InsertSitePricingPlan): Promise<SitePricingPlan> {
    const [created] = await db.insert(sitePricingPlans).values(plan).returning();
    return created;
  }

  async updateSitePricingPlan(id: number, updates: Partial<InsertSitePricingPlan>): Promise<SitePricingPlan | undefined> {
    const [updated] = await db.update(sitePricingPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sitePricingPlans.id, id))
      .returning();
    return updated;
  }

  async deleteSitePricingPlan(id: number): Promise<boolean> {
    await db.delete(sitePricingPlans).where(eq(sitePricingPlans.id, id));
    return true;
  }

  // ============ CMS Site FAQs ============
  async getSiteFaqs(): Promise<SiteFaq[]> {
    return await db.select().from(siteFaqs).orderBy(asc(siteFaqs.sortOrder));
  }

  async getSiteFaq(id: number): Promise<SiteFaq | undefined> {
    const [faq] = await db.select().from(siteFaqs).where(eq(siteFaqs.id, id));
    return faq;
  }

  async createSiteFaq(faq: InsertSiteFaq): Promise<SiteFaq> {
    const [created] = await db.insert(siteFaqs).values(faq).returning();
    return created;
  }

  async updateSiteFaq(id: number, updates: Partial<InsertSiteFaq>): Promise<SiteFaq | undefined> {
    const [updated] = await db.update(siteFaqs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteFaqs.id, id))
      .returning();
    return updated;
  }

  async deleteSiteFaq(id: number): Promise<boolean> {
    await db.delete(siteFaqs).where(eq(siteFaqs.id, id));
    return true;
  }

  // ============ CMS Site Testimonials ============
  async getSiteTestimonials(): Promise<SiteTestimonial[]> {
    return await db.select().from(siteTestimonials).orderBy(asc(siteTestimonials.sortOrder));
  }

  async getSiteTestimonial(id: number): Promise<SiteTestimonial | undefined> {
    const [testimonial] = await db.select().from(siteTestimonials).where(eq(siteTestimonials.id, id));
    return testimonial;
  }

  async createSiteTestimonial(testimonial: InsertSiteTestimonial): Promise<SiteTestimonial> {
    const [created] = await db.insert(siteTestimonials).values(testimonial).returning();
    return created;
  }

  async updateSiteTestimonial(id: number, updates: Partial<InsertSiteTestimonial>): Promise<SiteTestimonial | undefined> {
    const [updated] = await db.update(siteTestimonials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteTestimonials.id, id))
      .returning();
    return updated;
  }

  async deleteSiteTestimonial(id: number): Promise<boolean> {
    await db.delete(siteTestimonials).where(eq(siteTestimonials.id, id));
    return true;
  }

  // ============ Organizations (Co-ops) ============
  async getOrganizations(userId: string): Promise<Organization[]> {
    const memberships = await db.select()
      .from(orgMemberships)
      .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.status, 'active')));
    
    if (memberships.length === 0) return [];
    
    const orgIds = memberships.map(m => m.organizationId);
    return await db.select().from(organizations).where(inArray(organizations.id, orgIds));
  }

  async getOrganization(id: number, userId: string): Promise<Organization | undefined> {
    const membership = await this.getOrgMembership(id, userId);
    if (!membership || membership.status !== 'active') return undefined;
    
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization, ownerId: string): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    
    await db.insert(orgMemberships).values({
      organizationId: newOrg.id,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });
    
    return newOrg;
  }

  async updateOrganization(id: number, userId: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const role = await this.getUserRoleInOrg(userId, id);
    if (role !== 'owner') return undefined;
    
    const [updated] = await db.update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async deleteOrganization(id: number, userId: string): Promise<boolean> {
    const role = await this.getUserRoleInOrg(userId, id);
    if (role !== 'owner') return false;
    
    await db.delete(organizations).where(eq(organizations.id, id));
    return true;
  }

  // ============ Org Memberships ============
  async getOrgMemberships(organizationId: number): Promise<(OrgMembership & { user?: User })[]> {
    const memberships = await db.select().from(orgMemberships)
      .where(eq(orgMemberships.organizationId, organizationId));
    
    const result: (OrgMembership & { user?: User })[] = [];
    for (const m of memberships) {
      const [user] = await db.select().from(users).where(eq(users.id, m.userId));
      result.push({ ...m, user });
    }
    return result;
  }

  async getOrgMembership(organizationId: number, userId: string): Promise<OrgMembership | undefined> {
    const [membership] = await db.select().from(orgMemberships)
      .where(and(
        eq(orgMemberships.organizationId, organizationId),
        eq(orgMemberships.userId, userId)
      ));
    return membership;
  }

  async getUserOrgMemberships(userId: string): Promise<(OrgMembership & { organization: Organization })[]> {
    const memberships = await db.select().from(orgMemberships)
      .where(eq(orgMemberships.userId, userId));
    
    const result: (OrgMembership & { organization: Organization })[] = [];
    for (const m of memberships) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, m.organizationId));
      if (org) {
        result.push({ ...m, organization: org });
      }
    }
    return result;
  }

  async createOrgMembership(membership: InsertOrgMembership): Promise<OrgMembership> {
    const [created] = await db.insert(orgMemberships).values(membership).returning();
    return created;
  }

  async updateOrgMembership(id: number, updates: Partial<InsertOrgMembership>): Promise<OrgMembership | undefined> {
    const [updated] = await db.update(orgMemberships)
      .set(updates)
      .where(eq(orgMemberships.id, id))
      .returning();
    return updated;
  }

  async deleteOrgMembership(id: number): Promise<boolean> {
    await db.delete(orgMemberships).where(eq(orgMemberships.id, id));
    return true;
  }

  async getUserRoleInOrg(userId: string, organizationId: number): Promise<OrgRole | null> {
    const membership = await this.getOrgMembership(organizationId, userId);
    if (!membership || membership.status !== 'active') return null;
    return membership.role as OrgRole;
  }

  async isUserInCoopAccount(userId: string): Promise<boolean> {
    const memberships = await this.getUserOrgMemberships(userId);
    return memberships.some(m => 
      m.status === 'active' && m.organization.isCoopAccount === true
    );
  }

  // ============ Classes ============
  async getClasses(organizationId: number): Promise<Class[]> {
    return await db.select().from(classes)
      .where(eq(classes.organizationId, organizationId));
  }

  async getClassesForTeacher(teacherUserId: string): Promise<Class[]> {
    return await db.select().from(classes)
      .where(eq(classes.teacherUserId, teacherUserId));
  }

  async getClass(id: number): Promise<Class | undefined> {
    const [classData] = await db.select().from(classes).where(eq(classes.id, id));
    return classData;
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const [created] = await db.insert(classes).values(classData).returning();
    return created;
  }

  async updateClass(id: number, updates: Partial<InsertClass>): Promise<Class | undefined> {
    const [updated] = await db.update(classes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classes.id, id))
      .returning();
    return updated;
  }

  async deleteClass(id: number): Promise<boolean> {
    await db.delete(classes).where(eq(classes.id, id));
    return true;
  }

  // ============ Class Enrollments ============
  async getClassEnrollments(classId: number): Promise<(ClassEnrollment & { student: Student })[]> {
    const enrollments = await db.select().from(classEnrollments)
      .where(eq(classEnrollments.classId, classId));
    
    const result: (ClassEnrollment & { student: Student })[] = [];
    for (const e of enrollments) {
      const [student] = await db.select().from(students).where(eq(students.id, e.studentId));
      if (student) {
        result.push({ ...e, student });
      }
    }
    return result;
  }

  async getStudentEnrollments(studentId: number): Promise<(ClassEnrollment & { class: Class })[]> {
    const enrollments = await db.select().from(classEnrollments)
      .where(eq(classEnrollments.studentId, studentId));
    
    const result: (ClassEnrollment & { class: Class })[] = [];
    for (const e of enrollments) {
      const [classData] = await db.select().from(classes).where(eq(classes.id, e.classId));
      if (classData) {
        result.push({ ...e, class: classData });
      }
    }
    return result;
  }

  async enrollStudent(classId: number, studentId: number): Promise<ClassEnrollment> {
    const [existing] = await db.select().from(classEnrollments)
      .where(and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.studentId, studentId)
      ));
    
    if (existing) {
      if (existing.status !== 'active') {
        const [updated] = await db.update(classEnrollments)
          .set({ status: 'active', enrolledAt: new Date() })
          .where(eq(classEnrollments.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
    
    const [created] = await db.insert(classEnrollments)
      .values({ classId, studentId, status: 'active' })
      .returning();
    return created;
  }

  async unenrollStudent(classId: number, studentId: number): Promise<boolean> {
    await db.update(classEnrollments)
      .set({ status: 'withdrawn' })
      .where(and(
        eq(classEnrollments.classId, classId),
        eq(classEnrollments.studentId, studentId)
      ));
    return true;
  }

  // ============ Permission Helpers ============
  async getAccessibleStudentIds(userId: string, organizationId?: number): Promise<number[]> {
    const studentIds = new Set<number>();
    
    // 1. Students owned by this user (parent role - always included)
    const ownedStudents = await db.select({ id: students.id })
      .from(students)
      .where(eq(students.userId, userId));
    ownedStudents.forEach(s => studentIds.add(s.id));
    
    // 2. If organization context, check role-based access
    if (organizationId) {
      const role = await this.getUserRoleInOrg(userId, organizationId);
      
      if (role === 'teacher') {
        // Teachers see students enrolled in their classes
        const teacherClasses = await db.select({ id: classes.id })
          .from(classes)
          .where(and(
            eq(classes.organizationId, organizationId),
            eq(classes.teacherUserId, userId)
          ));
        
        for (const c of teacherClasses) {
          const enrollments = await db.select({ studentId: classEnrollments.studentId })
            .from(classEnrollments)
            .where(and(
              eq(classEnrollments.classId, c.id),
              eq(classEnrollments.status, 'active')
            ));
          enrollments.forEach(e => studentIds.add(e.studentId));
        }
      } else if (role === 'owner') {
        // Check if owner has canViewAllWork permission
        const membership = await this.getOrgMembership(organizationId, userId);
        if (membership?.canViewAllWork) {
          // Owner with explicit permission sees all org students
          const orgStudents = await db.select({ id: students.id })
            .from(students)
            .where(eq(students.organizationId, organizationId));
          orgStudents.forEach(s => studentIds.add(s.id));
        }
      }
    } else {
      // No org context - check all user's org memberships for teacher access
      const memberships = await this.getUserOrgMemberships(userId);
      for (const m of memberships) {
        if (m.status === 'active' && m.role === 'teacher') {
          const teacherClasses = await db.select({ id: classes.id })
            .from(classes)
            .where(and(
              eq(classes.organizationId, m.organizationId),
              eq(classes.teacherUserId, userId)
            ));
          
          for (const c of teacherClasses) {
            const enrollments = await db.select({ studentId: classEnrollments.studentId })
              .from(classEnrollments)
              .where(and(
                eq(classEnrollments.classId, c.id),
                eq(classEnrollments.status, 'active')
              ));
            enrollments.forEach(e => studentIds.add(e.studentId));
          }
        }
      }
    }
    
    return Array.from(studentIds);
  }

  async canAccessStudent(userId: string, studentId: number): Promise<boolean> {
    // Parent always has access to their own students
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) return false;
    if (student.userId === userId) return true;
    
    // Check if user is a teacher with this student enrolled in their class
    const accessibleIds = await this.getAccessibleStudentIds(userId, student.organizationId || undefined);
    return accessibleIds.includes(studentId);
  }

  async canAccessLesson(userId: string, lessonId: number): Promise<boolean> {
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    if (!lesson) return false;
    
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, lesson.subjectId));
    if (!subject) return false;
    
    // Creator has access
    if (subject.userId === userId) return true;
    
    // If subject is in a class, check if user is the teacher
    if (subject.classId) {
      const classData = await this.getClass(subject.classId);
      if (classData?.teacherUserId === userId) return true;
    }
    
    // Check subject-students assignments for access via student
    const subjectStudentsList = await db.select().from(subjectStudents)
      .where(eq(subjectStudents.subjectId, subject.id));
    
    for (const ss of subjectStudentsList) {
      if (await this.canAccessStudent(userId, ss.studentId)) {
        return true;
      }
    }
    
    return false;
  }

  // ============== CLASS LESSONS (Teacher-created assignments) ==============
  
  async getClassLessons(classId: number): Promise<ClassLesson[]> {
    return db.select().from(classLessons)
      .where(eq(classLessons.classId, classId))
      .orderBy(classLessons.dueDate);
  }

  async getClassLesson(id: number): Promise<ClassLesson | undefined> {
    const [lesson] = await db.select().from(classLessons)
      .where(eq(classLessons.id, id));
    return lesson;
  }

  async createClassLesson(data: InsertClassLesson): Promise<ClassLesson> {
    const [lesson] = await db.insert(classLessons).values(data).returning();
    return lesson;
  }

  async updateClassLesson(id: number, data: Partial<InsertClassLesson>): Promise<ClassLesson | undefined> {
    const [lesson] = await db.update(classLessons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classLessons.id, id))
      .returning();
    return lesson;
  }

  async deleteClassLesson(id: number): Promise<void> {
    await db.delete(classLessons).where(eq(classLessons.id, id));
  }

  // Get class lessons for a student based on their enrollments
  async getStudentClassLessons(studentId: number): Promise<(ClassLesson & { className: string; organizationName?: string })[]> {
    // Get all classes this student is enrolled in
    const enrollments = await db.select({
      classId: classEnrollments.classId
    }).from(classEnrollments)
      .where(and(
        eq(classEnrollments.studentId, studentId),
        eq(classEnrollments.status, 'active')
      ));
    
    if (enrollments.length === 0) return [];
    
    const classIds = enrollments.map(e => e.classId);
    
    // Get active lessons from these classes with class info
    const lessons = await db.select({
      lesson: classLessons,
      className: classes.name,
      organizationId: classes.organizationId
    }).from(classLessons)
      .innerJoin(classes, eq(classLessons.classId, classes.id))
      .where(and(
        inArray(classLessons.classId, classIds),
        eq(classLessons.isActive, true)
      ))
      .orderBy(classLessons.dueDate);
    
    // Get org names
    const result: (ClassLesson & { className: string; organizationName?: string })[] = [];
    for (const row of lessons) {
      let orgName: string | undefined;
      if (row.organizationId) {
        const [org] = await db.select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, row.organizationId));
        orgName = org?.name;
      }
      result.push({
        ...row.lesson,
        className: row.className,
        organizationName: orgName
      });
    }
    
    return result;
  }

  // Get submissions (evidence) for a specific class lesson
  async getClassLessonSubmissions(classLessonId: number): Promise<(EvidenceUpload & { studentName: string })[]> {
    const submissions = await db.select({
      evidence: evidenceUploads,
      studentName: students.name
    }).from(evidenceUploads)
      .innerJoin(students, eq(evidenceUploads.studentId, students.id))
      .where(eq(evidenceUploads.classLessonId, classLessonId))
      .orderBy(evidenceUploads.createdAt);
    
    return submissions.map(s => ({
      ...s.evidence,
      studentName: s.studentName
    }));
  }

  // Check if user can access a class lesson (is the teacher of the class)
  async canAccessClassLesson(userId: string, classLessonId: number): Promise<boolean> {
    const lesson = await this.getClassLesson(classLessonId);
    if (!lesson) return false;
    
    // Teacher owns the lesson
    if (lesson.teacherUserId === userId) return true;
    
    // Check if user has students enrolled in the class
    const enrollments = await db.select().from(classEnrollments)
      .where(eq(classEnrollments.classId, lesson.classId));
    
    for (const enrollment of enrollments) {
      if (await this.canAccessStudent(userId, enrollment.studentId)) {
        return true;
      }
    }
    
    return false;
  }

  // ============== TEACHER FEEDBACK ==============
  
  async getTeacherFeedback(evidenceId: number): Promise<TeacherFeedback[]> {
    return db.select().from(teacherFeedback)
      .where(eq(teacherFeedback.evidenceId, evidenceId))
      .orderBy(teacherFeedback.createdAt);
  }

  async createTeacherFeedback(data: InsertTeacherFeedback): Promise<TeacherFeedback> {
    const [feedback] = await db.insert(teacherFeedback).values(data).returning();
    return feedback;
  }

  async updateTeacherFeedback(id: number, data: Partial<InsertTeacherFeedback>): Promise<TeacherFeedback | undefined> {
    const [feedback] = await db.update(teacherFeedback)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherFeedback.id, id))
      .returning();
    return feedback;
  }

  async deleteTeacherFeedback(id: number): Promise<void> {
    await db.delete(teacherFeedback).where(eq(teacherFeedback.id, id));
  }

  // Check if user can give feedback on evidence (must be teacher of linked class lesson)
  async canGiveTeacherFeedback(userId: string, evidenceId: number): Promise<boolean> {
    const evidence = await this.getEvidenceUploadById(evidenceId);
    if (!evidence) return false;
    
    // Must be linked to a class lesson with sharedWithTeacher = true
    if (!evidence.classLessonId || !evidence.sharedWithTeacher) return false;
    
    const classLesson = await this.getClassLesson(evidence.classLessonId);
    if (!classLesson) return false;
    
    // User must be the teacher of that class
    return classLesson.teacherUserId === userId;
  }

  // ============== SCOPED EVIDENCE ACCESS ==============
  
  // Get evidence visible to a teacher (linked to their class lessons with sharedWithTeacher=true)
  async getTeacherVisibleEvidence(teacherUserId: string, classId?: number): Promise<EvidenceUpload[]> {
    // Get all class lessons taught by this teacher
    let classQuery = db.select().from(classLessons)
      .where(eq(classLessons.teacherUserId, teacherUserId));
    
    if (classId) {
      classQuery = db.select().from(classLessons)
        .where(and(
          eq(classLessons.teacherUserId, teacherUserId),
          eq(classLessons.classId, classId)
        ));
    }
    
    const lessons = await classQuery;
    if (lessons.length === 0) return [];
    
    const lessonIds = lessons.map(l => l.id);
    
    // Get evidence linked to these lessons with sharedWithTeacher=true
    return db.select().from(evidenceUploads)
      .where(and(
        inArray(evidenceUploads.classLessonId, lessonIds),
        eq(evidenceUploads.sharedWithTeacher, true)
      ))
      .orderBy(evidenceUploads.createdAt);
  }

  // Check if evidence is visible to a specific user based on scoping rules
  async canViewEvidence(userId: string, evidenceId: number): Promise<boolean> {
    const evidence = await this.getEvidenceUploadById(evidenceId);
    if (!evidence) return false;
    
    // Family always has access (parent who owns the student)
    if (await this.canAccessStudent(userId, evidence.studentId)) {
      return true;
    }
    
    // If linked to class lesson with sharedWithTeacher, check if user is the teacher
    if (evidence.classLessonId && evidence.sharedWithTeacher) {
      const classLesson = await this.getClassLesson(evidence.classLessonId);
      if (classLesson?.teacherUserId === userId) {
        return true;
      }
    }
    
    return false;
  }
}

export const storage = new DatabaseStorage();
