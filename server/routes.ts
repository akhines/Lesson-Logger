import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { subjects, lessons, students, formContent } from "@shared/schema";
import { z } from "zod";
import { eq, inArray, and } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { parseCurriculumContent } from "./services/curriculumParser";
import { registerWizardRoutes } from "./routes/wizard";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Setup Object Storage
  registerObjectStorageRoutes(app);
  
  // Register Wizard (AI Assistant) routes
  registerWizardRoutes(app);

  // Protected Routes Middleware
  const protect = isAuthenticated;

  // Students
  app.get(api.students.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const students = await storage.getStudents(userId);
    res.json(students);
  });

  app.get(api.students.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const student = await storage.getStudent(Number(req.params.id), userId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  app.post(api.students.create.path, protect, async (req: any, res) => {
    try {
      const input = api.students.create.input.parse({ ...req.body, userId: req.user.claims.sub });
      const student = await storage.createStudent(input);
      res.status(201).json(student);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.students.update.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.students.update.input.parse({ ...req.body, userId });
      const student = await storage.updateStudent(Number(req.params.id), userId, input);
      if (!student) return res.status(404).json({ message: "Student not found" });
      res.json(student);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.students.delete.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteStudent(Number(req.params.id), userId);
    res.status(204).end();
  });

  // Subjects
  app.get(api.subjects.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subjects = await storage.getSubjects(userId);
    res.json(subjects);
  });

  app.get(api.subjects.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subject = await storage.getSubject(Number(req.params.id), userId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
  });

  app.post(api.subjects.create.path, protect, async (req: any, res) => {
    try {
      console.log("[express] POST /api/subjects input:", req.body);
      const input = api.subjects.create.input.parse({ ...req.body, userId: req.user.claims.sub });
      const subject = await storage.createSubject(input);
      
      if (input.curriculumSource && input.curriculumSource !== "NONE") {
        try {
          await storage.generateLessonsFromCurriculum(subject.id, input.curriculumSource);
        } catch (genErr) {
          console.error("[express] Lesson generation error:", genErr);
          // Don't fail the whole request if generation fails
        }
      }
      
      res.status(201).json(subject);
    } catch (err) {
      console.error("[express] POST /api/subjects error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error", error: String(err) });
    }
  });

  app.put(api.subjects.update.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.subjects.update.input.parse({ ...req.body, userId });
      const subject = await storage.updateSubject(Number(req.params.id), userId, input);
      if (!subject) return res.status(404).json({ message: "Subject not found" });
      res.json(subject);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.subjects.delete.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteSubject(Number(req.params.id), userId);
    res.status(204).end();
  });

  // Lessons
  app.get(api.lessons.list.path, protect, async (req, res) => {
    const { subjectId, startDate, endDate } = req.query;
    const lessons = await storage.getLessons(
      subjectId ? Number(subjectId) : undefined,
      startDate as string,
      endDate as string
    );
    res.json(lessons);
  });

  app.get(api.lessons.get.path, protect, async (req, res) => {
    const lesson = await storage.getLesson(Number(req.params.id));
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    res.json(lesson);
  });

  app.post(api.lessons.create.path, protect, async (req, res) => {
    try {
      const input = api.lessons.create.input.parse(req.body);
      const lesson = await storage.createLesson(input);
      res.status(201).json(lesson);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.lessons.update.path, protect, async (req, res) => {
    try {
      const input = api.lessons.update.input.parse(req.body);
      const lesson = await storage.updateLesson(Number(req.params.id), input);
      res.json(lesson);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Lesson not found" });
    }
  });

  app.delete(api.lessons.delete.path, protect, async (req, res) => {
    await storage.deleteLesson(Number(req.params.id));
    res.status(204).end();
  });

  // Lesson Resources
  app.get(api.lessonResources.list.path, protect, async (req, res) => {
    const { lessonId } = req.query;
    const resources = await storage.getLessonResources(lessonId ? Number(lessonId) : undefined);
    res.json(resources);
  });

  app.get(api.lessonResources.get.path, protect, async (req, res) => {
    const resource = await storage.getLessonResource(Number(req.params.id));
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    res.json(resource);
  });

  app.post(api.lessonResources.create.path, protect, async (req, res) => {
    try {
      const input = api.lessonResources.create.input.parse(req.body);
      const resource = await storage.createLessonResource(input);
      res.status(201).json(resource);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.lessonResources.update.path, protect, async (req, res) => {
    try {
      const input = api.lessonResources.update.input.parse(req.body);
      const resource = await storage.updateLessonResource(Number(req.params.id), input);
      res.json(resource);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Resource not found" });
    }
  });

  app.delete(api.lessonResources.delete.path, protect, async (req, res) => {
    await storage.deleteLessonResource(Number(req.params.id));
    res.status(204).end();
  });

  // Student Auth (PIN-based login for students)
  // Lookup student by username - returns minimal info (only first name, avatar) to reduce PII exposure
  app.get("/api/student-auth/lookup", async (req, res) => {
    try {
      const { username } = req.query;
      if (!username || typeof username !== "string") {
        return res.status(400).json({ message: "Username required" });
      }
      
      const student = await db.select({
        id: students.id,
        name: students.name,
        avatar: students.avatar,
        username: students.username,
      }).from(students).where(eq(students.username, username.toLowerCase())).limit(1);
      
      if (student.length === 0) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Return only first name to reduce PII exposure
      const firstName = student[0].name.split(' ')[0];
      res.json({ 
        student: {
          id: student[0].id,
          name: firstName,
          avatar: student[0].avatar,
        }
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.studentAuth.login.path, async (req, res) => {
    try {
      const { studentId, pin } = req.body;
      const student = await storage.verifyStudentPin(studentId, pin);
      if (student) {
        // Store student session
        (req.session as any).studentId = student.id;
        res.json({ success: true, student });
      } else {
        res.status(401).json({ message: "Invalid PIN" });
      }
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Student portal endpoints (accessible with student PIN session)
  app.get("/api/student-portal/schedule", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    // Get subjects for this student
    const studentSubjects = await db.select().from(subjects).where(eq(subjects.studentId, studentId));
    const subjectIds = studentSubjects.map(s => s.id);
    const subjectUserIds = studentSubjects.map(s => s.userId);
    
    if (subjectIds.length === 0) {
      return res.json([]);
    }
    
    // Get lessons for these subjects
    const studentLessons = await db.select().from(lessons).where(inArray(lessons.subjectId, subjectIds));
    
    // Get all form content IDs from lessons
    const formContentIds = studentLessons
      .map(l => l.formContentId)
      .filter((id): id is number => id !== null);
    
    // Batch fetch form content (only from the student's parent user)
    let formContentMap = new Map<number, typeof formContent.$inferSelect>();
    if (formContentIds.length > 0 && subjectUserIds.length > 0) {
      const parentUserId = subjectUserIds[0]; // Student's parent
      const contents = await db.select()
        .from(formContent)
        .where(
          and(
            inArray(formContent.id, formContentIds),
            eq(formContent.userId, parentUserId) // Security: only fetch content owned by parent
          )
        );
      contents.forEach(c => formContentMap.set(c.id, c));
    }
    
    // Map lessons with their form content
    const lessonsWithContent = studentLessons.map(lesson => ({
      ...lesson,
      formContent: lesson.formContentId ? formContentMap.get(lesson.formContentId) || null : null
    }));
    
    res.json(lessonsWithContent);
  });

  app.get("/api/student-portal/assignments", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const assignmentsList = await storage.getAssignments({ studentId });
    res.json(assignmentsList);
  });

  app.get("/api/student-portal/me", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    // Direct query - student portal doesn't need parent userId check
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) return res.status(404).json({ message: "Student not found" });
    
    // Don't return the PIN
    const { pin, ...safeStudent } = student;
    res.json(safeStudent);
  });

  app.post("/api/student-auth/logout", async (req: any, res) => {
    if (req.session) {
      delete req.session.studentId;
    }
    res.json({ success: true });
  });

  // Form Content (Charlotte Mason custom curriculum)
  app.get(api.formContent.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { formLevel } = req.query;
    const content = await storage.getFormContent(userId, formLevel as string | undefined);
    res.json(content);
  });

  app.get(api.formContent.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const content = await storage.getFormContentById(Number(req.params.id), userId);
    if (!content) return res.status(404).json({ message: "Content not found" });
    res.json(content);
  });

  app.post(api.formContent.create.path, protect, async (req: any, res) => {
    try {
      const input = api.formContent.create.input.parse({ ...req.body, userId: req.user.claims.sub });
      const content = await storage.createFormContent(input);
      res.status(201).json(content);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.formContent.update.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.formContent.update.input.parse({ ...req.body, userId });
      const content = await storage.updateFormContent(Number(req.params.id), userId, input);
      if (!content) return res.status(404).json({ message: "Content not found" });
      res.json(content);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.formContent.delete.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteFormContent(Number(req.params.id), userId);
    res.status(204).end();
  });

  // Public endpoint to get students (for student login dropdown)
  app.get("/api/students/public", async (req, res) => {
    // Get all students without PIN details for login dropdown
    const allStudents = await db.select({
      id: students.id,
      name: students.name,
      color: students.color,
      gradeLevel: students.gradeLevel,
      pin: students.pin, // We check if pin exists but don't return it
    }).from(students);
    
    // Return students that have PIN set (for login), but don't expose the PIN value
    const studentsWithPin = allStudents
      .filter(s => s.pin)
      .map(({ pin, ...rest }) => ({ ...rest, hasPin: true }));
    
    res.json(studentsWithPin);
  });

  // Validation schemas for curriculum endpoints
  const curriculumParseSchema = z.object({
    content: z.string().max(10 * 1024 * 1024, "Content too large (max 10MB)"),
    contentType: z.enum(["text", "image", "pdf"]),
    mimeType: z.string().optional(),
  });

  const chapterSchema = z.object({
    chapterNumber: z.number(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    pageNumber: z.number().nullable().optional(),
  });

  const curriculumGenerateSchema = z.object({
    subjectId: z.number().int().positive(),
    chapters: z.array(chapterSchema).min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  });

  // AI Curriculum Upload - Parse table of contents
  app.post("/api/curriculum/parse", protect, async (req: any, res) => {
    try {
      const validatedInput = curriculumParseSchema.safeParse(req.body);
      if (!validatedInput.success) {
        return res.status(400).json({ 
          message: validatedInput.error.errors[0]?.message || "Invalid input"
        });
      }
      
      const { content, contentType, mimeType } = validatedInput.data;
      const result = await parseCurriculumContent(content, contentType, mimeType);
      res.json(result);
    } catch (error) {
      console.error("[curriculum-parse] Error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to parse curriculum" 
      });
    }
  });

  // Generate lessons from parsed curriculum chapters
  app.post("/api/curriculum/generate-lessons", protect, async (req: any, res) => {
    try {
      const validatedInput = curriculumGenerateSchema.safeParse(req.body);
      if (!validatedInput.success) {
        return res.status(400).json({ 
          message: validatedInput.error.errors[0]?.message || "Invalid input"
        });
      }
      
      const { subjectId, chapters, startDate } = validatedInput.data;
      const userId = req.user.claims.sub;
      
      const subject = await storage.getSubject(subjectId, userId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      
      const scheduledDays = subject.scheduledDays || [1, 2, 3, 4, 5];
      const createdLessons = [];
      
      // Parse date as UTC to avoid timezone issues
      const [year, month, day] = startDate.split("-").map(Number);
      let currentDate = new Date(Date.UTC(year, month - 1, day));
      
      for (const chapter of chapters) {
        while (!scheduledDays.includes(currentDate.getUTCDay())) {
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        const dateStr = currentDate.toISOString().split("T")[0];
        
        const lesson = await storage.createLesson({
          title: chapter.title,
          content: chapter.description || null,
          subjectId: subjectId,
          dateScheduled: dateStr,
          completed: false,
          link: null,
          formContentId: null,
        });
        
        await storage.createAssignment({
          title: chapter.title,
          description: chapter.description || null,
          lessonId: lesson.id,
          dueDate: dateStr,
          status: "pending",
          documentUrl: null,
          grade: null,
        });
        
        createdLessons.push(lesson);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
      
      res.json({ 
        success: true, 
        lessonsCreated: createdLessons.length,
        lessons: createdLessons 
      });
    } catch (error) {
      console.error("[curriculum-generate] Error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate lessons" 
      });
    }
  });

  // Days Off Routes
  const dayOffSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    reason: z.string().max(200).nullable().optional(),
  });

  app.get("/api/days-off", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const daysOff = await storage.getDaysOff(userId);
    res.json(daysOff);
  });

  app.post("/api/days-off", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validated = dayOffSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ message: validated.error.errors[0]?.message || "Invalid input" });
      }
      
      const { date, reason } = validated.data;
      
      // Check for duplicate
      const existingDaysOff = await storage.getDaysOff(userId);
      if (existingDaysOff.some(d => d.date === date)) {
        return res.status(409).json({ message: "A day off already exists for this date" });
      }
      
      const dayOff = await storage.createDayOff({ userId, date, reason: reason || null });
      
      // Automatically bump lessons for this day off
      const bumpedCount = await storage.bumpLessonsForDayOff(userId, date);
      
      res.status(201).json({ dayOff, bumpedLessons: bumpedCount });
    } catch (error) {
      console.error("Error creating day off:", error);
      res.status(500).json({ message: "Failed to create day off" });
    }
  });

  app.delete("/api/days-off/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteDayOff(Number(req.params.id), userId);
    res.status(204).end();
  });

  // Curriculum Resources Routes
  const curriculumResourceSchema = z.object({
    term: z.string().nullable().optional(),
    week: z.number().nullable().optional(),
    formLevel: z.string().nullable().optional(),
    subject: z.string().min(1, "Subject is required"),
    resourceLink: z.string().nullable().optional(),
    chapters: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  // Get all curriculum resources (with optional filters)
  app.get("/api/curriculum-resources", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const filters = {
      subject: req.query.subject as string | undefined,
      formLevel: req.query.formLevel as string | undefined,
      term: req.query.term as string | undefined,
    };
    const resources = await storage.getCurriculumResources(userId, filters);
    res.json(resources);
  });

  // Get unique subjects from curriculum resources
  app.get("/api/curriculum-resources/subjects", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const resources = await storage.getCurriculumResources(userId);
    const uniqueSubjects = Array.from(new Set(resources.map(r => r.subject))).sort();
    res.json(uniqueSubjects);
  });

  // Get a single curriculum resource
  app.get("/api/curriculum-resources/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const resource = await storage.getCurriculumResource(Number(req.params.id), userId);
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    res.json(resource);
  });

  // Create a single curriculum resource
  app.post("/api/curriculum-resources", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = curriculumResourceSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ message: validated.error.errors[0]?.message || "Invalid input" });
      }
      
      const resource = await storage.createCurriculumResource({ ...validated.data, userId });
      res.status(201).json(resource);
    } catch (error) {
      console.error("Error creating curriculum resource:", error);
      res.status(500).json({ message: "Failed to create curriculum resource" });
    }
  });

  // Bulk upload curriculum resources from CSV
  app.post("/api/curriculum-resources/upload", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const PapaModule = await import("papaparse");
      const Papa = PapaModule.default || PapaModule;
      
      const uploadSchema = z.object({
        csvContent: z.string().min(1, "CSV content is required"),
        subjectName: z.string().min(1, "Subject name is required"),
        columnMapping: z.record(z.string()).optional(),
      });
      
      const validated = uploadSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ message: validated.error.errors[0]?.message || "Invalid input" });
      }
      
      const { csvContent, subjectName, columnMapping } = validated.data;
      
      // Try parsing with different delimiters and pick the one with most columns
      const delimiters = [",", "\t", ";", "|"];
      let parseResult: any = null;
      let bestColumnCount = 0;
      
      for (const delimiter of delimiters) {
        const result = Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          delimiter: delimiter,
          quoteChar: '"',
          escapeChar: '"',
        });
        
        const columnCount = result.meta?.fields?.length || 0;
        if (columnCount > bestColumnCount && result.data.length > 0) {
          parseResult = result;
          bestColumnCount = columnCount;
        }
      }
      
      // Only fail on truly fatal errors when we can't parse any data
      if (!parseResult || parseResult.data.length === 0) {
        return res.status(400).json({ 
          message: "CSV parsing error: No valid data found.",
          errors: [] 
        });
      }
      
      // Build reverse mapping: targetField -> csvColumn
      const reverseMapping: Record<string, string> = {};
      if (columnMapping) {
        Object.entries(columnMapping).forEach(([csvCol, targetField]) => {
          if (targetField && targetField !== 'skip') {
            reverseMapping[targetField] = csvCol;
          }
        });
      }
      
      // Get value from row using mapping or fallback to auto-detection
      const getCol = (row: any, targetField: string, ...fallbackKeys: string[]) => {
        // If we have explicit mapping, use it
        if (reverseMapping[targetField]) {
          const val = row[reverseMapping[targetField]];
          return val !== undefined && val !== '' ? val : null;
        }
        // Fallback to auto-detection
        for (const key of fallbackKeys) {
          if (row[key] !== undefined && row[key] !== '') return row[key];
          const lowerKey = key.toLowerCase();
          const foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerKey);
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
        }
        return null;
      };
      
      // Map CSV rows to curriculum resources
      const resources = parseResult.data.map((row: any) => {
        const term = getCol(row, 'term', 'term', 'Term');
        const weekVal = getCol(row, 'week', 'week', 'Week');
        const week = weekVal ? parseInt(weekVal, 10) : null;
        const formLevel = getCol(row, 'form', 'form', 'Form', 'form_level', 'formLevel');
        const resourceLink = getCol(row, 'link', 'link', 'Link', 'resource_link', 'resourceLink', 
                            'link_to_resources', 'link to resources', 'url', 'URL');
        const chapters = getCol(row, 'chapters', 'chapters', 'Chapters', 'assigned_chapters', 
                        'assigned chapters', 'chapter', 'Chapter', 'description', 'lesson');
        const title = getCol(row, 'title', 'title', 'Title', 'name', 'Name');
        const notes = getCol(row, 'notes', 'notes', 'Notes');
        
        return {
          userId,
          term: term?.toString() || null,
          week: isNaN(week as number) ? null : week,
          formLevel: formLevel?.toString() || null,
          subject: subjectName,
          resourceLink: resourceLink?.toString() || null,
          chapters: chapters?.toString() || null,
          title: title?.toString() || null,
          notes: notes?.toString() || null,
        };
      }).filter((r: any) => r.subject); // Filter out rows without a subject
      
      if (resources.length === 0) {
        return res.status(400).json({ message: "No valid rows found in CSV" });
      }
      
      // Bulk insert
      const createdResources = await storage.createCurriculumResourcesBulk(resources);
      
      res.status(201).json({ 
        success: true, 
        count: createdResources.length,
        resources: createdResources 
      });
    } catch (error) {
      console.error("Error uploading curriculum resources:", error);
      res.status(500).json({ message: "Failed to upload curriculum resources" });
    }
  });

  // Update a curriculum resource
  app.put("/api/curriculum-resources/:id", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = curriculumResourceSchema.partial().safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ message: validated.error.errors[0]?.message || "Invalid input" });
      }
      
      const resource = await storage.updateCurriculumResource(Number(req.params.id), userId, validated.data);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      res.json(resource);
    } catch (error) {
      console.error("Error updating curriculum resource:", error);
      res.status(500).json({ message: "Failed to update curriculum resource" });
    }
  });

  // Update a curriculum resource
  app.patch("/api/curriculum-resources/:id", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = Number(req.params.id);
      const updateData = req.body;
      
      const updated = await storage.updateCurriculumResource(id, userId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Resource not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating curriculum resource:", error);
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  // Delete a curriculum resource
  app.delete("/api/curriculum-resources/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteCurriculumResource(Number(req.params.id), userId);
    res.status(204).end();
  });

  // Delete all curriculum resources for a subject
  app.delete("/api/curriculum-resources/subject/:subject", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteCurriculumResourcesBySubject(userId, req.params.subject);
    res.status(204).end();
  });

  // ============== Math Facts Sessions ==============
  
  // Get math facts sessions (for grading reports)
  app.get("/api/math-facts-sessions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    const sessions = await storage.getMathFactsSessions(userId, studentId, startDate, endDate);
    res.json(sessions);
  });

  // Create math facts session
  app.post("/api/math-facts-sessions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const session = await storage.createMathFactsSession({
      ...req.body,
      userId,
    });
    res.status(201).json(session);
  });

  // ============== Student Logins (Attendance) ==============
  
  // Get student logins (for attendance reports)
  app.get("/api/student-logins", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    const logins = await storage.getStudentLogins(userId, studentId, startDate, endDate);
    res.json(logins);
  });

  // Create student login (called when student logs in)
  app.post("/api/student-logins", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const login = await storage.createStudentLogin({
      ...req.body,
      userId,
    });
    res.status(201).json(login);
  });

  // Update student login (e.g., to record logout or lessons completed)
  app.patch("/api/student-logins/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const updatedLogin = await storage.updateStudentLogin(id, userId, req.body);
    if (!updatedLogin) {
      return res.status(404).json({ message: "Login session not found" });
    }
    res.json(updatedLogin);
  });

  // ============== Math Facts Assignments ==============
  
  // Get math facts assignments (parent view)
  app.get("/api/math-facts-assignments", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const assignments = await storage.getMathFactsAssignments(userId, studentId);
    res.json(assignments);
  });

  // Get math facts assignments for student (student portal)
  app.get("/api/student/:studentId/math-facts-assignments", async (req, res) => {
    const studentId = parseInt(req.params.studentId);
    const assignments = await storage.getMathFactsAssignmentsForStudent(studentId);
    res.json(assignments);
  });

  // Create math facts assignment
  app.post("/api/math-facts-assignments", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const assignment = await storage.createMathFactsAssignment({
      ...req.body,
      userId,
    });
    res.status(201).json(assignment);
  });

  // Update math facts assignment
  app.patch("/api/math-facts-assignments/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const updatedAssignment = await storage.updateMathFactsAssignment(id, userId, req.body);
    if (!updatedAssignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(updatedAssignment);
  });

  // Complete math facts assignment (for student portal)
  app.patch("/api/student/math-facts-assignments/:id/complete", async (req, res) => {
    const id = parseInt(req.params.id);
    const { sessionId } = req.body;
    
    // Get the assignment to find its userId
    const assignments = await storage.getMathFactsAssignmentsForStudent(req.body.studentId);
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    
    const updatedAssignment = await storage.updateMathFactsAssignment(id, assignment.userId, {
      completed: true,
      completedAt: new Date(),
      sessionId: sessionId || null,
    });
    res.json(updatedAssignment);
  });

  // Delete math facts assignment
  app.delete("/api/math-facts-assignments/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteMathFactsAssignment(id, userId);
    if (!deleted) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.status(204).send();
  });

  // ============== Reports Endpoints ==============
  
  // Get attendance report data
  app.get("/api/reports/attendance", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get student logins
    const logins = await storage.getStudentLogins(userId, studentId, startDate, endDate);
    
    // Get lessons completed in date range
    const lessons = await storage.getLessons(undefined, 
      startDate?.toISOString().split('T')[0], 
      endDate?.toISOString().split('T')[0]
    );
    const completedLessons = lessons.filter(l => l.completed);
    
    // Get students
    const students = await storage.getStudents(userId);
    
    res.json({
      logins,
      completedLessons,
      students,
    });
  });

  // Get grading report data (math facts)
  app.get("/api/reports/grades", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    
    // Get math facts sessions
    const mathFactsSessions = await storage.getMathFactsSessions(userId, studentId, startDate, endDate);
    
    // Get students
    const students = await storage.getStudents(userId);
    
    res.json({
      mathFactsSessions,
      students,
    });
  });

  return httpServer;
}
