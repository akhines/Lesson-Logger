import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { subjects, lessons, students, formContent, subjectStudents, lessonResources, studentLogins, evidenceUploads } from "@shared/schema";
import { z } from "zod";
import { eq, inArray, and, isNull, desc } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, objectStorageService } from "./replit_integrations/object_storage";
import { parseCurriculumContent } from "./services/curriculumParser";
import { registerWizardRoutes } from "./routes/wizard";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";

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

  // Generate upload token for a student
  app.post("/api/students/:id/generate-token", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = Number(req.params.id);
    
    try {
      const student = await storage.getStudent(studentId, userId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Generate a unique token
      const token = crypto.randomBytes(16).toString('hex');
      
      // Update student with the new token
      await db.update(students).set({ uploadToken: token }).where(eq(students.id, studentId));
      
      res.json({ token });
    } catch (error) {
      console.error("Error generating upload token:", error);
      res.status(500).json({ message: "Failed to generate upload token" });
    }
  });

  // Get QR code for a student
  app.get("/api/students/:id/qr-code", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = Number(req.params.id);
    
    try {
      const student = await storage.getStudent(studentId, userId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Generate token if not exists
      let token = (student as any).uploadToken;
      if (!token) {
        token = crypto.randomBytes(16).toString('hex');
        await db.update(students).set({ uploadToken: token }).where(eq(students.id, studentId));
      }
      
      // Generate upload URL
      const baseUrl = req.protocol + '://' + req.get('host');
      const uploadUrl = `${baseUrl}/upload/${token}`;
      
      // Generate QR code as SVG string
      const qrSvg = await QRCode.toString(uploadUrl, {
        type: 'svg',
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      
      res.json({ 
        svg: qrSvg, 
        uploadUrl,
        studentName: student.name 
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Public route: Get student info by upload token (no auth required)
  app.get("/api/upload/:token", async (req, res) => {
    const token = req.params.token;
    
    try {
      const [student] = await db.select().from(students).where(eq(students.uploadToken, token));
      
      if (!student) {
        return res.status(404).json({ message: "Invalid upload link" });
      }
      
      // Get available labels for this user
      const labels = await storage.getPortfolioLabels(student.userId);
      
      res.json({
        valid: true,
        studentName: student.name,
        studentId: student.id,
        labels: labels.map(l => ({ id: l.id, name: l.name, color: l.color }))
      });
    } catch (error) {
      console.error("Error getting upload info:", error);
      res.status(500).json({ message: "Failed to load upload page" });
    }
  });

  // Public route: Get presigned URL for token-based upload
  app.post("/api/upload/:token/presign", async (req, res) => {
    const token = req.params.token;
    const { fileName, contentType } = req.body;
    
    try {
      const [student] = await db.select().from(students).where(eq(students.uploadToken, token));
      
      if (!student) {
        return res.status(404).json({ message: "Invalid upload link" });
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/wav'];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "File type not allowed" });
      }
      
      // Get presigned URL using the object storage service
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      
      // Extract the object path from the upload URL
      const urlObj = new URL(uploadUrl);
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      
      res.json({ uploadUrl, objectPath });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({ message: "Failed to prepare upload" });
    }
  });

  // Public route: Save evidence upload via token
  app.post("/api/upload/:token/save", async (req, res) => {
    const token = req.params.token;
    const { objectPath, fileName, contentType, title, description, labelIds } = req.body;
    
    try {
      const [student] = await db.select().from(students).where(eq(students.uploadToken, token));
      
      if (!student) {
        return res.status(404).json({ message: "Invalid upload link" });
      }
      
      // Determine file type
      let fileType = 'document';
      if (contentType.startsWith('image/')) fileType = 'image';
      else if (contentType.startsWith('audio/')) fileType = 'audio';
      else if (contentType === 'application/pdf') fileType = 'pdf';
      
      // Construct file URL using the object path
      const fileUrl = `/api/object-storage${objectPath}`;
      
      // Create evidence upload (pending review)
      const evidence = await storage.createEvidenceUpload({
        studentId: student.id,
        userId: student.userId,
        lessonId: null, // QR uploads are not linked to a specific lesson
        fileUrl,
        fileName,
        fileType,
        title: title || fileName,
        description: description || 'Uploaded via QR code',
        reviewStatus: 'pending'
      });
      
      // Assign labels if provided
      if (labelIds && Array.isArray(labelIds)) {
        for (const labelId of labelIds) {
          await storage.assignEvidenceLabel(evidence.id, labelId);
        }
      }
      
      res.json({ success: true, evidenceId: evidence.id });
    } catch (error) {
      console.error("Error saving evidence:", error);
      res.status(500).json({ message: "Failed to save upload" });
    }
  });

  // Subjects
  app.get(api.subjects.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subjects = await storage.getSubjects(userId);
    // Include students for each subject
    const subjectsWithStudents = await Promise.all(
      subjects.map(async (subject) => {
        const students = await storage.getSubjectStudents(subject.id);
        return { ...subject, students };
      })
    );
    res.json(subjectsWithStudents);
  });

  app.get(api.subjects.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subject = await storage.getSubject(Number(req.params.id), userId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    // Include students for the subject
    const students = await storage.getSubjectStudents(subject.id);
    res.json({ ...subject, students });
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

  // Subject-Student relationships (multiple students per subject)
  app.get("/api/subjects/:id/students", protect, async (req: any, res) => {
    const subjectId = Number(req.params.id);
    const students = await storage.getSubjectStudents(subjectId);
    res.json(students);
  });

  app.put("/api/subjects/:id/students", protect, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds)) {
        return res.status(400).json({ message: "studentIds must be an array" });
      }
      await storage.setSubjectStudents(subjectId, studentIds);
      const students = await storage.getSubjectStudents(subjectId);
      res.json(students);
    } catch (err) {
      console.error("[express] PUT /api/subjects/:id/students error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
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
      console.log("[lesson-resources] Create request body:", JSON.stringify(req.body));
      const input = api.lessonResources.create.input.parse(req.body);
      console.log("[lesson-resources] Parsed input:", JSON.stringify(input));
      const resource = await storage.createLessonResource(input);
      console.log("[lesson-resources] Created resource:", JSON.stringify(resource));
      res.status(201).json(resource);
    } catch (err) {
      console.error("[lesson-resources] Error creating resource:", err);
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
        
        // Record login for attendance tracking
        try {
          const loginRecord = await storage.createStudentLogin({
            studentId: student.id,
            userId: student.userId, // Parent who owns this student
          });
          // Store the login session ID for updating later (e.g., on logout)
          (req.session as any).loginSessionId = loginRecord.id;
        } catch (loginErr) {
          console.error("Failed to record student login for attendance:", loginErr);
          // Don't fail the login if attendance recording fails
        }
        
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
    
    // Get subjects for this student using junction table (supports multiple students per subject)
    const subjectStudentRows = await db.select({ subject: subjects })
      .from(subjectStudents)
      .innerJoin(subjects, eq(subjectStudents.subjectId, subjects.id))
      .where(eq(subjectStudents.studentId, studentId));
    
    // Also include subjects with the legacy studentId field for backwards compatibility
    const legacySubjects = await db.select().from(subjects).where(eq(subjects.studentId, studentId));
    
    // Combine and deduplicate
    const allSubjects = [
      ...subjectStudentRows.map(r => r.subject),
      ...legacySubjects
    ];
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    const studentSubjects = Array.from(subjectMap.values());
    
    const subjectIds = studentSubjects.map(s => s.id);
    const subjectUserIds = studentSubjects.map(s => s.userId);
    
    if (subjectIds.length === 0) {
      return res.json([]);
    }
    
    // Get lessons for these subjects
    const studentLessons = await db.select().from(lessons).where(inArray(lessons.subjectId, subjectIds));
    
    const lessonIds = studentLessons.map(l => l.id);
    
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
    
    // Batch fetch lesson resources for all lessons
    let resourcesMap = new Map<number, typeof lessonResources.$inferSelect[]>();
    if (lessonIds.length > 0) {
      const resources = await db.select()
        .from(lessonResources)
        .where(inArray(lessonResources.lessonId, lessonIds));
      resources.forEach(r => {
        if (!resourcesMap.has(r.lessonId)) {
          resourcesMap.set(r.lessonId, []);
        }
        resourcesMap.get(r.lessonId)!.push(r);
      });
    }
    
    // Create a subject lookup map
    const subjectLookup = new Map(studentSubjects.map(s => [s.id, s]));
    
    // Map lessons with their form content, resources, and subject info
    const lessonsWithContent = studentLessons.map(lesson => ({
      ...lesson,
      formContent: lesson.formContentId ? formContentMap.get(lesson.formContentId) || null : null,
      resources: resourcesMap.get(lesson.id) || [],
      subject: subjectLookup.get(lesson.subjectId) || null
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
      const loginSessionId = req.session.loginSessionId;
      const studentId = req.session.studentId;
      
      if (studentId) {
        try {
          // Get the parent userId for this student
          const [student] = await db.select({ userId: students.userId })
            .from(students)
            .where(eq(students.id, studentId));
          
          if (student) {
            if (loginSessionId) {
              // Update specific login session
              await storage.updateStudentLogin(loginSessionId, student.userId, {
                logoutAt: new Date(),
              });
            } else {
              // Fallback: update most recent open login record for this student
              const [mostRecentLogin] = await db.select()
                .from(studentLogins)
                .where(and(
                  eq(studentLogins.studentId, studentId),
                  eq(studentLogins.userId, student.userId),
                  isNull(studentLogins.logoutAt)
                ))
                .orderBy(desc(studentLogins.loginAt))
                .limit(1);
              
              if (mostRecentLogin) {
                await storage.updateStudentLogin(mostRecentLogin.id, student.userId, {
                  logoutAt: new Date(),
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to record logout time:", err);
        }
      }
      
      delete req.session.studentId;
      delete req.session.loginSessionId;
    }
    res.json({ success: true });
  });

  // Update student avatar
  app.patch("/api/student-portal/avatar", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const { avatar } = req.body;
    if (typeof avatar !== "string") {
      return res.status(400).json({ message: "Invalid avatar data" });
    }
    
    // Update the student's avatar
    const [updated] = await db.update(students)
      .set({ avatar })
      .where(eq(students.id, studentId))
      .returning();
    
    if (!updated) return res.status(404).json({ message: "Student not found" });
    
    const { pin, ...safeStudent } = updated;
    res.json(safeStudent);
  });

  app.get("/api/student-portal/math-facts-assignments", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const assignments = await storage.getMathFactsAssignmentsForStudent(studentId);
    res.json(assignments);
  });

  // Student portal library access - allows students to browse parent's library
  app.get("/api/student-portal/library", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      // Get the student to find their parent's userId
      const [student] = await db.select().from(students).where(eq(students.id, studentId));
      if (!student) return res.status(404).json({ message: "Student not found" });
      
      // Get library items for the parent
      const items = await storage.getLibraryItems(student.userId);
      
      // Filter to show only items suitable for students (exclude private document uploads)
      const studentItems = items.filter(item => 
        item.mediaType !== "document" || !item.fileUrl?.includes("private")
      );
      
      res.json(studentItems);
    } catch (error) {
      console.error("Student library error:", error);
      res.status(500).json({ message: "Failed to load library" });
    }
  });

  // PDF Proxy - fetch external PDFs to avoid CORS issues
  app.get("/api/pdf-proxy", async (req: any, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: "Failed to fetch PDF" });
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("PDF proxy error:", error);
      res.status(500).json({ message: "Failed to fetch PDF" });
    }
  });

  // PDF Annotations - get annotations for a lesson
  app.get("/api/student-portal/pdf-annotations/:lessonId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const lessonId = parseInt(req.params.lessonId);
    if (isNaN(lessonId)) return res.status(400).json({ message: "Invalid lesson ID" });
    
    try {
      const annotations = await storage.getPdfAnnotations(lessonId, studentId);
      res.json(annotations);
    } catch (error) {
      console.error("Get PDF annotations error:", error);
      res.status(500).json({ message: "Failed to load annotations" });
    }
  });

  // PDF Annotations - save all annotations for a lesson
  app.post("/api/student-portal/pdf-annotations/:lessonId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const lessonId = parseInt(req.params.lessonId);
    if (isNaN(lessonId)) return res.status(400).json({ message: "Invalid lesson ID" });
    
    const { annotations } = req.body;
    if (!Array.isArray(annotations)) {
      return res.status(400).json({ message: "Annotations must be an array" });
    }
    
    try {
      const saved = await storage.savePdfAnnotations(lessonId, studentId, annotations);
      res.json(saved);
    } catch (error) {
      console.error("Save PDF annotations error:", error);
      res.status(500).json({ message: "Failed to save annotations" });
    }
  });

  // Student Evidence Upload - attach work to lessons
  app.post("/api/student-portal/evidence", async (req: any, res) => {
    const studentId = req.session?.studentId;
    const userId = req.session?.userId;
    if (!studentId || !userId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const { lessonId, title, description, fileUrl, fileType, fileName, fileSize } = req.body;
      
      if (!fileUrl || !fileType) {
        return res.status(400).json({ message: "File URL and type are required" });
      }
      
      const evidence = await storage.createEvidenceUpload({
        lessonId: lessonId || null,
        studentId,
        userId,
        title: title || null,
        description: description || null,
        fileUrl,
        fileType,
        fileName: fileName || null,
        fileSize: fileSize || null,
        uploadedBy: "student",
        reviewStatus: "pending",
        reviewNotes: null,
      });
      
      res.json(evidence);
    } catch (error) {
      console.error("Create evidence error:", error);
      res.status(500).json({ message: "Failed to save evidence" });
    }
  });

  // Get evidence for a lesson (student view)
  app.get("/api/student-portal/evidence/:lessonId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const lessonId = parseInt(req.params.lessonId);
    if (isNaN(lessonId)) return res.status(400).json({ message: "Invalid lesson ID" });
    
    try {
      const evidence = await storage.getEvidenceForLesson(lessonId, studentId);
      res.json(evidence);
    } catch (error) {
      res.status(500).json({ message: "Failed to get evidence" });
    }
  });

  // Student can search external libraries (Gutenberg, Librivox) - proxied through server
  app.get("/api/student-portal/search-gutenberg", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const query = req.query.q as string;
    if (!query || query.trim().length < 2) {
      return res.json({ results: [] });
    }
    
    try {
      const response = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(query)}&languages=en`);
      if (!response.ok) throw new Error("Gutenberg API error");
      const data = await response.json();
      
      const results = data.results?.slice(0, 12).map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.authors?.map((a: any) => a.name).join(", ") || "Unknown",
        coverUrl: book.formats?.["image/jpeg"] || null,
      })) || [];
      
      res.json({ results });
    } catch (error) {
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // Student AI helper - kid-friendly assistant
  app.post("/api/student-portal/ask-helper", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const { question, studentName } = req.body;
    
    if (!question || typeof question !== "string") {
      return res.status(400).json({ message: "Question is required" });
    }
    
    if (question.length > 1000) {
      return res.status(400).json({ message: "Question is too long" });
    }
    
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a friendly, patient, and encouraging study helper for homeschool students. Your name is "Study Helper".

Guidelines:
- Use simple, age-appropriate language suitable for K-12 students
- Be encouraging and supportive, never condescending
- Keep answers concise but helpful (2-4 paragraphs max)
- If explaining something complex, use examples a child would understand
- Never provide inappropriate content or discuss anything unsuitable for children
- If asked about something you shouldn't help with, gently redirect to studying
- Use a warm, friendly tone with occasional encouragement
- When helping with math or reading, guide them to understand rather than just giving answers
- If the student seems frustrated, offer encouragement and simpler explanations

The student's name is ${studentName || "friend"}. Address them by name occasionally to be friendly.`
          },
          {
            role: "user",
            content: question
          }
        ],
        max_completion_tokens: 500,
      });
      
      const answer = response.choices[0]?.message?.content;
      if (!answer) {
        throw new Error("No response from AI");
      }
      
      res.json({ answer });
    } catch (error) {
      console.error("Student helper error:", error);
      res.status(500).json({ message: "I'm having trouble thinking right now. Please try again!" });
    }
  });

  // Check writing for spelling and grammar errors
  app.post("/api/student-portal/check-writing", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return res.json({ errors: [] });
    }
    
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful writing assistant for students. Analyze the following text for spelling, grammar, and style errors. 

Return a JSON array of errors. Each error should have:
- "start": character position where the error starts (0-indexed)
- "end": character position where the error ends
- "text": the exact text that contains the error
- "type": one of "spelling", "grammar", or "style"
- "message": a friendly, encouraging explanation of the issue (suitable for a child)
- "suggestions": an array of 1-3 suggested corrections

Only include actual errors. Be encouraging in your messages. If there are no errors, return an empty array.

IMPORTANT: Return ONLY the JSON array, no other text. Example format:
[{"start":0,"end":5,"text":"teh","type":"spelling","message":"This word looks like it might be 'the' with the letters mixed up!","suggestions":["the"]}]`
          },
          {
            role: "user",
            content: text.substring(0, 3000) // Limit text length
          }
        ],
        max_completion_tokens: 1500,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.json({ errors: [] });
      }
      
      // Parse the JSON response
      try {
        // Clean up the response - remove markdown code blocks if present
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```json")) {
          jsonStr = jsonStr.slice(7);
        } else if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith("```")) {
          jsonStr = jsonStr.slice(0, -3);
        }
        jsonStr = jsonStr.trim();
        
        const errors = JSON.parse(jsonStr);
        res.json({ errors: Array.isArray(errors) ? errors : [] });
      } catch (parseError) {
        console.error("Failed to parse writing check response:", content);
        res.json({ errors: [] });
      }
    } catch (error) {
      console.error("Check writing error:", error);
      res.status(500).json({ message: "Failed to check writing" });
    }
  });

  // Student can access Gutenberg book content
  app.get("/api/student-portal/gutenberg-content/:sourceId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const sourceId = req.params.sourceId;
    try {
      const textUrl = `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.txt`;
      const textResponse = await fetch(textUrl);
      
      if (textResponse.ok) {
        const text = await textResponse.text();
        const lines = text.split('\n');
        let startIndex = 0;
        let endIndex = lines.length;
        
        for (let i = 0; i < Math.min(lines.length, 100); i++) {
          if (lines[i].includes('*** START OF') || lines[i].includes('***START OF')) {
            startIndex = i + 1;
            break;
          }
        }
        
        for (let i = lines.length - 1; i > Math.max(0, lines.length - 100); i--) {
          if (lines[i].includes('*** END OF') || lines[i].includes('***END OF')) {
            endIndex = i;
            break;
          }
        }
        
        const content = lines.slice(startIndex, endIndex).join('\n').trim();
        res.type('text/plain').send(content);
      } else {
        res.status(404).json({ message: "Book content not available" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch book content" });
    }
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
  app.patch("/api/student/math-facts-assignments/:id/complete", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const id = parseInt(req.params.id);
    const { sessionId } = req.body;
    
    // Get the assignment to find its userId - verify it belongs to the student
    const assignments = await storage.getMathFactsAssignmentsForStudent(studentId);
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found or not authorized" });
    }
    
    const updatedAssignment = await storage.updateMathFactsAssignment(id, assignment.userId, {
      completed: true,
      completedAt: new Date(),
      sessionId: sessionId || null,
    });
    res.json(updatedAssignment);
  });

  // Save math facts session for student portal
  const studentSessionSchema = z.object({
    studentId: z.number(),
    operation: z.enum(["addition", "subtraction", "multiplication", "division"]),
    maxNumber: z.number().min(1).max(100),
    totalProblems: z.number().min(1).max(50),
    correctAnswers: z.number().min(0),
    averageTimeMs: z.number().min(0),
  });

  app.post("/api/student-portal/math-facts-sessions", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Validate request body
    const parsed = studentSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid session data", errors: parsed.error.errors });
    }
    
    // Verify the studentId in the body matches the session
    if (parsed.data.studentId !== studentId) {
      return res.status(403).json({ message: "Cannot save sessions for other students" });
    }
    
    // Get the student to find parent userId
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    const session = await storage.createMathFactsSession({
      ...parsed.data,
      userId: student.userId,
    });
    res.status(201).json(session);
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

  // ============== Grammar Practice Assignments ==============
  
  // Get grammar assignments (parent view)
  app.get("/api/grammar-assignments", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const assignments = await storage.getGrammarAssignments(userId, studentId);
    res.json(assignments);
  });

  // Get grammar assignments for student (student portal)
  app.get("/api/student-portal/grammar-assignments", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const assignments = await storage.getGrammarAssignmentsForStudent(studentId);
    res.json(assignments);
  });

  // Create grammar assignment
  app.post("/api/grammar-assignments", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const assignment = await storage.createGrammarAssignment({
      ...req.body,
      userId,
    });
    res.status(201).json(assignment);
  });

  // Update grammar assignment
  app.patch("/api/grammar-assignments/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const updatedAssignment = await storage.updateGrammarAssignment(id, userId, req.body);
    if (!updatedAssignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(updatedAssignment);
  });

  // Complete grammar assignment (for student portal)
  app.patch("/api/student/grammar-assignments/:id/complete", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const id = parseInt(req.params.id);
    const { score } = req.body;
    
    // Get the assignment to verify it belongs to the student
    const assignments = await storage.getGrammarAssignmentsForStudent(studentId);
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found or not authorized" });
    }
    
    const updatedAssignment = await storage.updateGrammarAssignment(id, assignment.userId, {
      completed: true,
      completedAt: new Date(),
      score: score || null,
    });
    res.json(updatedAssignment);
  });

  // Delete grammar assignment
  app.delete("/api/grammar-assignments/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteGrammarAssignment(id, userId);
    if (!deleted) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.status(204).send();
  });

  // Mark lesson complete (for student portal)
  app.patch("/api/student/lessons/:id/complete", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const lessonId = parseInt(req.params.id);
    
    // Get subjects for this student using junction table
    const subjectStudentRows = await db.select({ subject: subjects })
      .from(subjectStudents)
      .innerJoin(subjects, eq(subjectStudents.subjectId, subjects.id))
      .where(eq(subjectStudents.studentId, studentId));
    
    // Also include subjects with the legacy studentId field for backwards compatibility
    const legacySubjects = await db.select().from(subjects).where(eq(subjects.studentId, studentId));
    
    // Combine and deduplicate
    const allSubjects = [
      ...subjectStudentRows.map(r => r.subject),
      ...legacySubjects
    ];
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    const studentSubjects = Array.from(subjectMap.values());
    const subjectIds = studentSubjects.map(s => s.id);
    
    if (subjectIds.length === 0) {
      return res.status(404).json({ message: "Lesson not found or not authorized" });
    }
    
    // Get the lesson and verify it belongs to one of the student's subjects
    const studentLessons = await db.select().from(lessons).where(
      and(
        eq(lessons.id, lessonId),
        inArray(lessons.subjectId, subjectIds)
      )
    );
    
    if (studentLessons.length === 0) {
      return res.status(404).json({ message: "Lesson not found or not authorized" });
    }
    
    const updatedLesson = await storage.updateLesson(lessonId, {
      completed: true,
    });
    res.json(updatedLesson);
  });

  // ============== Library Items ==============

  // Get all library items
  app.get("/api/library", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const type = req.query.type as string | undefined;
    const mediaType = req.query.mediaType as string | undefined;
    const source = req.query.source as string | undefined;
    const items = await storage.getLibraryItems(userId, { type, mediaType, source });
    res.json(items);
  });

  // Get single library item
  app.get("/api/library/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const item = await storage.getLibraryItem(id, userId);
    if (!item) {
      return res.status(404).json({ message: "Library item not found" });
    }
    res.json(item);
  });

  // Create library item (personal upload or saved public resource)
  app.post("/api/library", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const item = await storage.createLibraryItem({
      ...req.body,
      userId,
    });
    res.status(201).json(item);
  });

  // Update library item
  app.patch("/api/library/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const updatedItem = await storage.updateLibraryItem(id, userId, req.body);
    if (!updatedItem) {
      return res.status(404).json({ message: "Library item not found" });
    }
    res.json(updatedItem);
  });

  // Delete library item
  app.delete("/api/library/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteLibraryItem(id, userId);
    if (!deleted) {
      return res.status(404).json({ message: "Library item not found" });
    }
    res.status(204).send();
  });

  // Search Librivox public domain audiobooks
  app.get("/api/library/search/librivox", protect, async (req: any, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }
    try {
      // Try searching by title first (with ^ prefix for partial match)
      const titleResponse = await fetch(
        `https://librivox.org/api/feed/audiobooks?title=^${encodeURIComponent(query)}&format=json`
      );
      
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        if (titleData.books && titleData.books.length > 0) {
          return res.json(titleData.books);
        }
      }
      
      // If no title matches, try searching by author
      const authorResponse = await fetch(
        `https://librivox.org/api/feed/audiobooks?author=^${encodeURIComponent(query)}&format=json`
      );
      
      if (authorResponse.ok) {
        const authorData = await authorResponse.json();
        if (authorData.books && authorData.books.length > 0) {
          return res.json(authorData.books);
        }
      }
      
      // No results found
      res.json([]);
    } catch (error) {
      console.error("Librivox search error:", error);
      res.status(500).json({ message: "Failed to search Librivox" });
    }
  });

  // Search Project Gutenberg ebooks
  app.get("/api/library/search/gutenberg", protect, async (req: any, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }
    try {
      const response = await fetch(
        `https://gutendex.com/books?search=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error("Gutenberg API error");
      }
      const data = await response.json();
      res.json(data.results || []);
    } catch (error) {
      console.error("Gutenberg search error:", error);
      res.status(500).json({ message: "Failed to search Project Gutenberg" });
    }
  });

  // Get Gutenberg book content (proxied to avoid CORS, returns plain text)
  app.get("/api/library/gutenberg-content/:sourceId", protect, async (req: any, res) => {
    const sourceId = req.params.sourceId;
    try {
      // Try to get plain text version first (safest)
      const textUrl = `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.txt`;
      const textResponse = await fetch(textUrl);
      
      if (textResponse.ok) {
        const text = await textResponse.text();
        // Remove Gutenberg header/footer boilerplate
        const lines = text.split('\n');
        let startIndex = 0;
        let endIndex = lines.length;
        
        // Find start of actual content (after Project Gutenberg header)
        for (let i = 0; i < Math.min(lines.length, 100); i++) {
          if (lines[i].includes('*** START OF') || lines[i].includes('***START OF')) {
            startIndex = i + 1;
            break;
          }
        }
        
        // Find end of actual content (before Project Gutenberg footer)
        for (let i = lines.length - 1; i > Math.max(0, lines.length - 100); i--) {
          if (lines[i].includes('*** END OF') || lines[i].includes('***END OF')) {
            endIndex = i;
            break;
          }
        }
        
        const content = lines.slice(startIndex, endIndex).join('\n').trim();
        res.type('text/plain').send(content);
      } else {
        res.status(404).json({ message: "Book content not available" });
      }
    } catch (error) {
      console.error("Gutenberg content error:", error);
      res.status(500).json({ message: "Failed to fetch book content" });
    }
  });

  // Generate comprehension questions from selected text using AI
  app.post("/api/library/generate-questions", protect, async (req: any, res) => {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: "Text is required" });
    }
    
    if (text.length < 20) {
      return res.status(400).json({ message: "Please select a longer passage (at least 20 characters)" });
    }
    
    if (text.length > 5000) {
      return res.status(400).json({ message: "Passage is too long. Please select less than 5000 characters." });
    }
    
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an educational assistant helping homeschool parents create comprehension questions for their students. Generate thoughtful, age-appropriate questions that test understanding of the text passage. Questions should:
- Be clear and specific
- Cover main ideas, vocabulary, inference, and critical thinking
- Be appropriate for K-12 students
- Avoid yes/no questions when possible

Return ONLY a JSON object with a "questions" array containing 5-7 question strings. No other text.`
          },
          {
            role: "user",
            content: `Generate comprehension questions for this passage:\n\n"${text}"`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }
      
      const parsed = JSON.parse(content);
      const questions = parsed.questions || [];
      
      res.json({ questions });
    } catch (error) {
      console.error("Question generation error:", error);
      res.status(500).json({ message: "Failed to generate questions. Please try again." });
    }
  });

  // ============== Portfolio Endpoints ==============

  // Portfolio Labels CRUD
  app.get("/api/portfolio/labels", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId) : undefined;
    const labels = await storage.getPortfolioLabels(userId, subjectId);
    res.json(labels);
  });

  app.post("/api/portfolio/labels", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const label = await storage.createPortfolioLabel({
        ...req.body,
        userId,
      });
      res.json(label);
    } catch (error) {
      console.error("Create label error:", error);
      res.status(500).json({ message: "Failed to create label" });
    }
  });

  app.patch("/api/portfolio/labels/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const updated = await storage.updatePortfolioLabel(id, userId, req.body);
    if (!updated) return res.status(404).json({ message: "Label not found" });
    res.json(updated);
  });

  app.delete("/api/portfolio/labels/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deletePortfolioLabel(id, userId);
    if (!deleted) return res.status(404).json({ message: "Label not found" });
    res.json({ success: true });
  });

  // Evidence Uploads (parent view/management)
  app.get("/api/portfolio/evidence", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const filters = {
      studentId: req.query.studentId ? parseInt(req.query.studentId) : undefined,
      lessonId: req.query.lessonId ? parseInt(req.query.lessonId) : undefined,
      reviewStatus: req.query.reviewStatus as string | undefined,
    };
    const evidence = await storage.getEvidenceUploads(userId, filters);
    res.json(evidence);
  });

  app.get("/api/portfolio/evidence/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const evidence = await storage.getEvidenceUpload(id, userId);
    if (!evidence) return res.status(404).json({ message: "Evidence not found" });
    res.json(evidence);
  });

  // Parent can also upload evidence on behalf of student
  app.post("/api/portfolio/evidence", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const evidence = await storage.createEvidenceUpload({
        ...req.body,
        userId,
        uploadedBy: "parent",
        reviewStatus: "approved", // Parent uploads are auto-approved
      });
      res.json(evidence);
    } catch (error) {
      console.error("Create evidence error:", error);
      res.status(500).json({ message: "Failed to create evidence" });
    }
  });

  // Update evidence (review, add labels, notes)
  app.patch("/api/portfolio/evidence/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    
    // Handle label updates separately if provided
    if (req.body.labelIds) {
      await storage.setEvidenceLabels(id, req.body.labelIds);
      delete req.body.labelIds;
    }
    
    // If reviewing, set reviewedAt timestamp
    if (req.body.reviewStatus && req.body.reviewStatus !== "pending") {
      req.body.reviewedAt = new Date();
    }
    
    const updated = await storage.updateEvidenceUpload(id, userId, req.body);
    if (!updated) return res.status(404).json({ message: "Evidence not found" });
    res.json(updated);
  });

  app.delete("/api/portfolio/evidence/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteEvidenceUpload(id, userId);
    if (!deleted) return res.status(404).json({ message: "Evidence not found" });
    res.json({ success: true });
  });

  // Get evidence labels for a specific evidence item
  app.get("/api/portfolio/evidence/:id/labels", protect, async (req: any, res) => {
    const id = parseInt(req.params.id);
    const labels = await storage.getEvidenceLabels(id);
    res.json(labels);
  });

  // Get pending review count for dashboard badge
  app.get("/api/portfolio/pending-count", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count = await storage.getPendingReviewCount(userId);
    res.json({ count });
  });

  // Get pending evidence for review queue
  app.get("/api/portfolio/evidence/pending", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const evidence = await storage.getEvidenceUploads(userId, { reviewStatus: "pending" });
    
    // Enrich with student/lesson/subject info and labels
    const allStudents = await storage.getStudents(userId);
    const allSubjects = await storage.getSubjects(userId);
    
    const enrichedEvidence = await Promise.all(evidence.map(async (e) => {
      const student = allStudents.find(s => s.id === e.studentId);
      let lessonTitle = undefined;
      let subjectName = undefined;
      
      if (e.lessonId) {
        const lessons = await storage.getLessons();
        const lesson = lessons.find(l => l.id === e.lessonId);
        if (lesson) {
          lessonTitle = lesson.title;
          const subject = allSubjects.find(s => s.id === lesson.subjectId);
          if (subject) subjectName = subject.name;
        }
      }
      
      const labels = await storage.getEvidenceLabels(e.id);
      
      return {
        ...e,
        studentName: student?.name,
        lessonTitle,
        subjectName,
        labels,
      };
    }));
    
    res.json(enrichedEvidence);
  });

  // Review evidence (approve/reject with notes and labels)
  app.patch("/api/portfolio/evidence/:id/review", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const { reviewStatus, reviewNotes, labelIds } = req.body;
    
    // Update evidence status
    const updated = await storage.updateEvidenceUpload(id, userId, {
      reviewStatus,
      reviewNotes,
    });
    
    if (!updated) {
      return res.status(404).json({ message: "Evidence not found" });
    }
    
    // Update labels if provided
    if (labelIds && Array.isArray(labelIds)) {
      await storage.setEvidenceLabels(id, labelIds);
    }
    
    res.json(updated);
  });

  // Export portfolio as PDF
  app.get("/api/portfolio/export", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const labelId = req.query.labelId ? parseInt(req.query.labelId) : undefined;
    
    try {
      // Get all user's students and labels first for validation
      const allStudents = await storage.getStudents(userId);
      const labels = await storage.getPortfolioLabels(userId);
      
      // Validate studentId belongs to user if provided
      if (studentId && !allStudents.find(s => s.id === studentId)) {
        return res.status(403).json({ message: "Student not found or not authorized" });
      }
      
      // Validate labelId belongs to user if provided
      if (labelId && !labels.find(l => l.id === labelId)) {
        return res.status(403).json({ message: "Label not found or not authorized" });
      }
      
      // Get all approved evidence
      const evidence = await storage.getEvidenceUploads(userId, { 
        studentId: studentId, 
        reviewStatus: "approved" 
      });
      
      // Batch fetch all labels for all evidence items to avoid N+1 queries
      const evidenceWithLabels = await Promise.all(
        evidence.map(async (e) => {
          try {
            const eLabels = await storage.getEvidenceLabels(e.id);
            return { ...e, labels: eLabels };
          } catch {
            return { ...e, labels: [] };
          }
        })
      );
      
      // Filter by label if specified
      let filteredEvidence = evidenceWithLabels;
      if (labelId) {
        filteredEvidence = evidenceWithLabels.filter(e => 
          e.labels.some(l => l.id === labelId)
        );
      }
      
      // Group by student
      const groupedByStudent = new Map<number, typeof filteredEvidence>();
      for (const e of filteredEvidence) {
        const existing = groupedByStudent.get(e.studentId) || [];
        existing.push(e);
        groupedByStudent.set(e.studentId, existing);
      }
      
      // Create PDF
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      const selectedStudent = studentId ? allStudents.find(s => s.id === studentId) : undefined;
      const selectedLabel = labelId ? labels.find(l => l.id === labelId) : undefined;
      
      let filename = "portfolio";
      if (selectedStudent) filename += `_${selectedStudent.name.replace(/\s+/g, '_')}`;
      if (selectedLabel) filename += `_${selectedLabel.name.replace(/\s+/g, '_')}`;
      filename += ".pdf";
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      
      doc.pipe(res);
      
      // Title page
      doc.fontSize(28).font("Helvetica-Bold").text("Student Portfolio", { align: "center" });
      doc.moveDown();
      doc.fontSize(14).font("Helvetica").text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
      
      if (selectedStudent) {
        doc.moveDown();
        doc.fontSize(18).text(`Student: ${selectedStudent.name}`, { align: "center" });
      }
      if (selectedLabel) {
        doc.moveDown();
        doc.fontSize(16).text(`Category: ${selectedLabel.name}`, { align: "center" });
      }
      
      doc.moveDown(2);
      doc.fontSize(12).text(`Total items: ${filteredEvidence.length}`, { align: "center" });
      
      // Content pages grouped by student
      for (const [sid, items] of Array.from(groupedByStudent.entries())) {
        const student = allStudents.find(s => s.id === sid);
        if (!student) continue;
        
        doc.addPage();
        doc.fontSize(22).font("Helvetica-Bold").text(student.name, { underline: true });
        doc.moveDown();
        
        // Group items by first label (or "Uncategorized") - labels already fetched
        const byLabel = new Map<string, typeof items>();
        for (const item of items) {
          const labelName = item.labels.length > 0 ? item.labels[0].name : "Uncategorized";
          const existing = byLabel.get(labelName) || [];
          existing.push(item);
          byLabel.set(labelName, existing);
        }
        
        for (const [labelName, labelItems] of Array.from(byLabel.entries())) {
          doc.fontSize(16).font("Helvetica-Bold").fillColor("#333333").text(labelName);
          doc.moveDown(0.5);
          
          for (const item of labelItems) {
            doc.fontSize(12).font("Helvetica").fillColor("#000000");
            doc.text(`• ${item.title || item.fileName || "Untitled"}`, { continued: false });
            
            if (item.description) {
              doc.fontSize(10).fillColor("#666666").text(`  ${item.description}`);
            }
            
            doc.fontSize(10).fillColor("#888888");
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Unknown date";
            doc.text(`  Added: ${dateStr} | Type: ${item.fileType}`);
            
            if (item.reviewNotes) {
              doc.fontSize(10).fillColor("#444444").text(`  Notes: ${item.reviewNotes}`);
            }
            
            doc.moveDown(0.5);
          }
          
          doc.moveDown();
        }
      }
      
      if (filteredEvidence.length === 0) {
        doc.addPage();
        doc.fontSize(14).text("No approved evidence found matching the selected filters.", { align: "center" });
      }
      
      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
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

  // ============== Admin Middleware ==============
  
  const requireAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUserById(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  // ============== Site Settings Endpoints ==============
  
  // Get all site settings (public - for landing page)
  app.get("/api/site-settings/public", async (req: any, res) => {
    const settings = await storage.getSiteSettings();
    res.json(settings);
  });

  // Get all site settings (authenticated - for admin panel)
  app.get("/api/site-settings", protect, async (req: any, res) => {
    const settings = await storage.getSiteSettings();
    res.json(settings);
  });

  // Update a site setting (admin only)
  app.put("/api/site-settings/:key", protect, requireAdmin, async (req: any, res) => {
    const { key } = req.params;
    const { value } = req.body;
    
    const setting = await storage.upsertSiteSetting(key, value);
    res.json(setting);
  });

  // Batch update site settings (admin only) - with validation
  const siteSettingsBatchSchema = z.object({
    settings: z.array(z.object({
      key: z.string().min(1).max(100),
      value: z.string().nullable(),
    })),
  });

  app.put("/api/site-settings", protect, requireAdmin, async (req: any, res) => {
    const parseResult = siteSettingsBatchSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid settings format", details: parseResult.error.issues });
    }
    
    const { settings } = parseResult.data;
    const results = await Promise.all(
      settings.map(s => storage.upsertSiteSetting(s.key, s.value))
    );
    res.json(results);
  });

  // Delete a site setting (admin only)
  app.delete("/api/site-settings/:key", protect, requireAdmin, async (req: any, res) => {
    const { key } = req.params;
    
    await storage.deleteSiteSetting(key);
    res.status(204).send();
  });

  // ============== User Management Endpoints (Admin Only) ==============
  
  // Check if current user is admin
  app.get("/api/admin/check", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const userEmail = req.user.claims.email;
    const user = await storage.getUserById(userId);
    
    // Debug logging
    console.log(`[Admin Check] userId: ${userId}, email: ${userEmail}, user found: ${!!user}, isAdmin: ${user?.isAdmin}`);
    
    // Check if user is admin by isAdmin field, or by being the primary admin email
    const ADMIN_EMAIL = "ashley@theimpacthometeam.com";
    const isAdmin = user?.isAdmin || userEmail === ADMIN_EMAIL;
    
    // If user exists and email matches admin but isAdmin is false, update it
    if (user && userEmail === ADMIN_EMAIL && !user.isAdmin) {
      console.log(`[Admin Check] Granting admin to user ${userId} with email ${userEmail}`);
      await storage.updateUser(userId, { isAdmin: true });
    }
    
    res.json({ isAdmin });
  });

  // Get all users (admin only)
  app.get("/api/admin/users", protect, requireAdmin, async (req: any, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // Update user (admin only) - with strict field whitelist
  const adminUserUpdateSchema = z.object({
    isAdmin: z.boolean().optional(),
  }).strict();

  app.patch("/api/admin/users/:id", protect, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const parseResult = adminUserUpdateSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid update fields. Only 'isAdmin' can be modified.", details: parseResult.error.issues });
    }
    
    const updates = parseResult.data;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    
    const updated = await storage.updateUser(id, updates);
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(updated);
  });

  // Get all students for admin (admin only)
  app.get("/api/admin/students", protect, requireAdmin, async (req: any, res) => {
    const students = await storage.getAllStudentsAdmin();
    res.json(students);
  });

  // Reset student PIN (admin only) - with Zod validation
  const studentPinSchema = z.object({
    pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits").nullable().optional(),
  });

  app.patch("/api/admin/students/:id/pin", protect, requireAdmin, async (req: any, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }
    
    const parseResult = studentPinSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid PIN format", details: parseResult.error.issues });
    }
    
    const pin = parseResult.data.pin || null;
    const updated = await storage.updateStudentPin(studentId, pin);
    if (!updated) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.json(updated);
  });

  // Delete user (admin only) - prevent self-deletion
  app.delete("/api/admin/users/:id", protect, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const adminId = req.user.claims.sub;
    
    // Prevent admin from deleting themselves
    if (id === adminId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    
    // Prevent deleting other admins
    const targetUser = await storage.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    if (targetUser.isAdmin) {
      return res.status(400).json({ error: "Cannot delete an admin account" });
    }
    
    await storage.deleteUser(id);
    res.status(204).send();
  });

  // Impersonate parent/teacher account (admin only)
  app.post("/api/admin/impersonate/:id", protect, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const adminId = req.user.claims.sub;
    
    const targetUser = await storage.getUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Store admin ID in session for later restoration
    req.session.originalAdminId = adminId;
    req.session.impersonatingUserId = id;
    
    // Update session to use impersonated user's claims
    req.user.claims = {
      ...req.user.claims,
      sub: targetUser.id,
      email: targetUser.email,
      first_name: targetUser.firstName,
      last_name: targetUser.lastName,
    };
    
    req.session.save((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Failed to start impersonation" });
      }
      res.json({ 
        success: true, 
        message: `Now impersonating ${targetUser.firstName} ${targetUser.lastName}`,
        user: targetUser
      });
    });
  });

  // Stop impersonation and return to admin account
  app.post("/api/admin/stop-impersonation", protect, async (req: any, res) => {
    const originalAdminId = req.session.originalAdminId;
    
    if (!originalAdminId) {
      return res.status(400).json({ error: "Not currently impersonating anyone" });
    }
    
    const adminUser = await storage.getUserById(originalAdminId);
    if (!adminUser) {
      return res.status(500).json({ error: "Original admin account not found" });
    }
    
    // Restore admin claims
    req.user.claims = {
      ...req.user.claims,
      sub: adminUser.id,
      email: adminUser.email,
      first_name: adminUser.firstName,
      last_name: adminUser.lastName,
    };
    
    // Clear impersonation state
    delete req.session.originalAdminId;
    delete req.session.impersonatingUserId;
    
    req.session.save((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Failed to stop impersonation" });
      }
      res.json({ 
        success: true, 
        message: "Returned to admin account",
        user: adminUser
      });
    });
  });

  // Check impersonation status
  app.get("/api/admin/impersonation-status", protect, async (req: any, res) => {
    const impersonatingUserId = req.session.impersonatingUserId;
    const originalAdminId = req.session.originalAdminId;
    
    if (impersonatingUserId && originalAdminId) {
      const targetUser = await storage.getUserById(impersonatingUserId);
      res.json({ 
        isImpersonating: true, 
        targetUser: targetUser ? {
          id: targetUser.id,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        } : null
      });
    } else {
      res.json({ isImpersonating: false });
    }
  });

  // Impersonate student (admin only) - for student portal access
  app.post("/api/admin/impersonate-student/:id", protect, requireAdmin, async (req: any, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }
    
    const student = await storage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Generate a session token that can be used for student portal access
    // This token is stored in the session for server-side validation
    const sessionToken = Buffer.from(JSON.stringify({
      studentId: student.id,
      studentName: student.name,
      adminId: req.user.claims.sub,
      timestamp: Date.now(),
    })).toString('base64');
    
    // Store in session for validation
    req.session.adminStudentViewToken = sessionToken;
    req.session.adminStudentViewId = student.id;
    
    req.session.save((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Failed to create viewing session" });
      }
      res.json({ 
        success: true,
        token: sessionToken,
        student: {
          id: student.id,
          name: student.name,
        }
      });
    });
  });

  // Validate admin student view token
  app.post("/api/admin/validate-student-view", protect, requireAdmin, async (req: any, res) => {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ valid: false, error: "No token provided" });
    }
    
    // Validate token matches what's stored in session
    const sessionToken = req.session.adminStudentViewToken;
    const sessionStudentId = req.session.adminStudentViewId;
    
    if (!sessionToken || sessionToken !== token) {
      return res.status(401).json({ valid: false, error: "Invalid or expired token" });
    }
    
    // Token is valid, return the student ID
    const student = await storage.getStudentById(sessionStudentId);
    if (!student) {
      return res.status(404).json({ valid: false, error: "Student not found" });
    }
    
    res.json({ 
      valid: true, 
      studentId: sessionStudentId,
      studentName: student.name
    });
  });

  // Get student data for admin viewing - validates session token
  app.get("/api/admin/view-student/:id", protect, requireAdmin, async (req: any, res) => {
    const studentId = parseInt(req.params.id);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }
    
    // Validate that this student ID matches the session token
    const sessionStudentId = req.session.adminStudentViewId;
    if (!sessionStudentId || sessionStudentId !== studentId) {
      return res.status(403).json({ error: "Not authorized to view this student" });
    }
    
    const student = await storage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Admin can view this student (validated against session)
    res.json(student);
  });

  // Get lessons for admin viewing of student portal
  app.get("/api/admin/view-student-lessons/:studentId", protect, requireAdmin, async (req: any, res) => {
    const studentId = parseInt(req.params.studentId);
    
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }
    
    // Validate that this student ID matches the session token
    const sessionStudentId = req.session.adminStudentViewId;
    if (!sessionStudentId || sessionStudentId !== studentId) {
      return res.status(403).json({ error: "Not authorized to view this student's lessons" });
    }
    
    const student = await storage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // Get the student's user (parent) ID
    const subjects = await storage.getSubjects(student.userId);
    const studentSubjects = subjects.filter(s => s.studentId === studentId);
    
    // Get lessons for these subjects
    const allLessons: any[] = [];
    for (const subject of studentSubjects) {
      const lessons = await storage.getLessons(subject.id);
      const formContents = await storage.getFormContent(student.userId);
      
      const lessonsWithFormContent = lessons.map(lesson => {
        let formContent = null;
        if (lesson.formContentId) {
          formContent = formContents.find(
            (fc: any) => fc.id === lesson.formContentId
          ) || null;
        }
        return { ...lesson, formContent, subject };
      });
      
      allLessons.push(...lessonsWithFormContent);
    }
    
    res.json(allLessons);
  });

  return httpServer;
}
