import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { subjects, lessons, students, formContent, subjectStudents, lessonResources, studentLogins, evidenceUploads, users, SUBSCRIPTION_PLANS, teacherFeedback, classSessions, attendanceRecords, classLessons, classEnrollments, notificationPreferences, insertLessonLogSchema } from "@shared/schema";
import { z } from "zod";
import { eq, inArray, and, isNull, desc, sql } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, objectStorageService } from "./replit_integrations/object_storage";
import { parseCurriculumContent } from "./services/curriculumParser";
import { registerWizardRoutes } from "./routes/wizard";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import { sendEmail, getNewAssignmentEmail, getDueSoonEmail, getMissingSubmissionEmail } from "./services/emailService";
import { runAllReminders } from "./services/reminderService";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check (used by load balancers)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Setup Object Storage. Uploads depend on external object storage that may not
  // be configured on every host; don't let its absence crash server startup.
  try {
    registerObjectStorageRoutes(app);
  } catch (err) {
    console.warn("Object storage routes not registered:", (err as Error).message);
  }
  
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
      
      // Construct file URL using the object path (served at /objects/...)
      const fileUrl = objectPath;
      
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
    const userId = req.user.claims.sub;
    const subjectId = Number(req.params.id);
    
    // Verify access to the subject
    const subject = await storage.getSubject(subjectId, userId);
    if (!subject) {
      return res.status(403).json({ message: "Access denied to this subject" });
    }
    
    const studentsList = await storage.getSubjectStudents(subjectId);
    res.json(studentsList);
  });

  app.put("/api/subjects/:id/students", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subjectId = Number(req.params.id);
      
      // Verify access to the subject (must own or teach it)
      const subject = await storage.getSubject(subjectId, userId);
      if (!subject) {
        return res.status(403).json({ message: "Access denied to this subject" });
      }
      
      // Only subject owner can modify student assignments
      if (subject.userId !== userId) {
        // Check if teacher of class
        if (subject.classId) {
          const classData = await storage.getClass(subject.classId);
          if (classData?.teacherUserId !== userId) {
            return res.status(403).json({ message: "Only subject owner or class teacher can modify students" });
          }
        } else {
          return res.status(403).json({ message: "Only subject owner can modify students" });
        }
      }
      
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds)) {
        return res.status(400).json({ message: "studentIds must be an array" });
      }
      
      // Validate all studentIds are accessible to this user
      for (const studentId of studentIds) {
        const canAccess = await storage.canAccessStudent(userId, studentId);
        if (!canAccess) {
          return res.status(403).json({ message: `Cannot add student ${studentId} - access denied` });
        }
      }
      
      await storage.setSubjectStudents(subjectId, studentIds);
      const studentsList = await storage.getSubjectStudents(subjectId);
      res.json(studentsList);
    } catch (err) {
      console.error("[express] PUT /api/subjects/:id/students error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Lessons
  app.get(api.lessons.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { subjectId, startDate, endDate } = req.query;
    
    // If subjectId provided, verify access to that subject
    if (subjectId) {
      const subject = await storage.getSubject(Number(subjectId), userId);
      if (!subject) {
        return res.status(403).json({ message: "Access denied to this subject" });
      }
    }
    
    const allLessons = await storage.getLessons(
      subjectId ? Number(subjectId) : undefined,
      startDate as string,
      endDate as string
    );
    
    // Filter lessons by access permission if no subjectId filter
    if (!subjectId) {
      const accessibleLessons = [];
      for (const lesson of allLessons) {
        if (await storage.canAccessLesson(userId, lesson.id)) {
          accessibleLessons.push(lesson);
        }
      }
      return res.json(accessibleLessons);
    }
    
    res.json(allLessons);
  });

  app.get(api.lessons.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    const lesson = await storage.getLesson(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    
    // Check permission
    const canAccess = await storage.canAccessLesson(userId, lessonId);
    if (!canAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(lesson);
  });

  app.post(api.lessons.create.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.lessons.create.input.parse(req.body);
      
      // Verify access to the subject
      const subject = await storage.getSubject(input.subjectId, userId);
      if (!subject) {
        return res.status(403).json({ message: "Access denied to create lesson for this subject" });
      }
      
      const lesson = await storage.createLesson(input);
      res.status(201).json(lesson);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.lessons.update.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lessonId = Number(req.params.id);
      
      // Check permission
      const canAccess = await storage.canAccessLesson(userId, lessonId);
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const input = api.lessons.update.input.parse(req.body);
      const lesson = await storage.updateLesson(lessonId, input);
      res.json(lesson);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Lesson not found" });
    }
  });

  app.delete(api.lessons.delete.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    // Check permission
    const canAccess = await storage.canAccessLesson(userId, lessonId);
    if (!canAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteLesson(lessonId);
    res.status(204).end();
  });

  // Lesson Resources
  app.get(api.lessonResources.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { lessonId } = req.query;
    
    if (lessonId) {
      // Verify access to the lesson
      const canAccess = await storage.canAccessLesson(userId, Number(lessonId));
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied to lesson resources" });
      }
    }
    
    const resources = await storage.getLessonResources(lessonId ? Number(lessonId) : undefined);
    
    // If no lessonId filter, filter by permission
    if (!lessonId) {
      const accessibleResources = [];
      for (const resource of resources) {
        if (await storage.canAccessLesson(userId, resource.lessonId)) {
          accessibleResources.push(resource);
        }
      }
      return res.json(accessibleResources);
    }
    
    res.json(resources);
  });

  app.get(api.lessonResources.get.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const resource = await storage.getLessonResource(Number(req.params.id));
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    
    // Check permission via lesson
    const canAccess = await storage.canAccessLesson(userId, resource.lessonId);
    if (!canAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(resource);
  });

  app.post(api.lessonResources.create.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = api.lessonResources.create.input.parse(req.body);
      
      // Verify access to the lesson
      const canAccess = await storage.canAccessLesson(userId, input.lessonId);
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied to create resource for this lesson" });
      }
      
      const resource = await storage.createLessonResource(input);
      res.status(201).json(resource);
    } catch (err) {
      console.error("[lesson-resources] Error creating resource:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.lessonResources.update.path, protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const resourceId = Number(req.params.id);
      
      // Get resource to check lesson access
      const existingResource = await storage.getLessonResource(resourceId);
      if (!existingResource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      const canAccess = await storage.canAccessLesson(userId, existingResource.lessonId);
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const input = api.lessonResources.update.input.parse(req.body);
      const resource = await storage.updateLessonResource(resourceId, input);
      res.json(resource);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Resource not found" });
    }
  });

  app.delete(api.lessonResources.delete.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const resourceId = Number(req.params.id);
    
    // Get resource to check lesson access
    const existingResource = await storage.getLessonResource(resourceId);
    if (!existingResource) {
      return res.status(404).json({ message: "Resource not found" });
    }
    
    const canAccess = await storage.canAccessLesson(userId, existingResource.lessonId);
    if (!canAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteLessonResource(resourceId);
    res.status(204).end();
  });

  // Dashboard Summary
  app.get("/api/dashboard/summary", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - mondayOffset);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      
      const [weekLogs, recentLogs, allStudents, allSubjects, pendingEvidence] = await Promise.all([
        storage.getLessonLogs(userId, { startDate: weekStartStr, endDate: todayStr }),
        storage.getLessonLogs(userId, {}),
        storage.getStudents(userId),
        storage.getSubjects(userId),
        storage.getEvidenceUploads(userId, { reviewStatus: "pending" }),
      ]);

      const last3Logs = recentLogs.slice(0, 3);
      const weekMinutes = weekLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
      const weekLessonCount = weekLogs.length;

      let streakCount = 0;
      const checkDate = new Date(today);
      const logDates = new Set(recentLogs.map(l => l.date));
      while (logDates.has(checkDate.toISOString().split("T")[0])) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      const uniqueSubjectsUsed = new Set(recentLogs.filter(l => {
        const logDate = new Date(l.date);
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(today.getDate() - 14);
        return logDate >= twoWeeksAgo;
      }).map(l => l.subjectName));

      const hasLogToday = weekLogs.some(l => l.date === todayStr);

      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      const recentDayLogs = recentLogs.filter(l => new Date(l.date) >= threeDaysAgo);
      const hasRecentLogs = recentDayLogs.length > 0;

      const recommendations: any[] = [];

      if (allStudents.length === 0) {
        recommendations.push({
          id: "add-first-student",
          title: "Add your first student",
          description: "Get started by adding a student to your family.",
          ctaLabel: "Add Student",
          ctaHref: "/students",
          priority: 1,
        });
      } else if (!hasLogToday) {
        recommendations.push({
          id: "log-today",
          title: "Log today's learning",
          description: "Take a moment to record what was covered today.",
          ctaLabel: "Quick Log",
          ctaAction: "openQuickLog",
          priority: 1,
        });
      }

      if (!hasRecentLogs && allStudents.length > 0) {
        recommendations.push({
          id: "catch-up",
          title: "Catch up on recent days",
          description: "It looks like a few days slipped by — no worries, you can log them now.",
          ctaLabel: "Log a Recent Day",
          ctaAction: "openQuickLog",
          priority: 2,
        });
      }

      if (uniqueSubjectsUsed.size <= 1 && allStudents.length > 0 && recentLogs.length > 0) {
        recommendations.push({
          id: "add-subject",
          title: "Try logging another subject",
          description: "Variety helps! Consider logging a different subject this week.",
          ctaLabel: "View Subjects",
          ctaHref: "/lesson-logging",
          priority: 3,
        });
      }

      if (allStudents.length === 1 && allStudents.length > 0) {
        recommendations.push({
          id: "add-student",
          title: "Add another student",
          description: "If you have more than one learner, you can track them separately.",
          ctaLabel: "Add Student",
          ctaHref: "/students",
          priority: 4,
        });
      }

      if (recommendations.length === 0 && hasLogToday) {
        recommendations.push({
          id: "all-caught-up",
          title: "You're all caught up!",
          description: "Great work today. Check back tomorrow for your next steps.",
          ctaLabel: "View Logs",
          ctaHref: "/lesson-logging",
          priority: 5,
        });
      }

      res.json({
        weekTotals: { minutes: weekMinutes, lessons: weekLessonCount },
        streakCount,
        recentLogs: last3Logs,
        recommendations: recommendations.sort((a, b) => a.priority - b.priority).slice(0, 3),
        studentCount: allStudents.length,
        subjectCount: allSubjects.length,
        pendingEvidenceCount: pendingEvidence.length,
      });
    } catch (err) {
      console.error("Dashboard summary error:", err);
      res.status(500).json({ message: "Failed to load dashboard summary" });
    }
  });

  app.get("/api/onboarding/status", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [allStudents, allSubjects, allLogs, allEvidence, allLessons, user] = await Promise.all([
        storage.getStudents(userId),
        storage.getSubjects(userId),
        storage.getLessonLogs(userId, {}),
        storage.getEvidenceUploads(userId, {}),
        storage.getLessons(),
        storage.getUserById(userId),
      ]);

      const userSubjectIds = allSubjects.map(s => s.id);
      const hasScheduledLessons = allLessons.some(l => userSubjectIds.includes(l.subjectId));

      res.json({
        hasStudents: allStudents.length > 0,
        studentCount: allStudents.length,
        subjectCount: allSubjects.length,
        hasAnyLessonLogs: allLogs.length > 0,
        lessonLogCount: allLogs.length,
        hasAnyEvidence: allEvidence.length > 0,
        evidenceCount: allEvidence.length,
        hasScheduledLessons,
        onboardingComplete: user?.onboardingComplete ?? false,
      });
    } catch (err) {
      console.error("Onboarding status error:", err);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  app.post("/api/onboarding/complete", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { onboardingComplete: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to update onboarding status" });
    }
  });

  app.post("/api/onboarding/skip", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUser(userId, { onboardingComplete: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to skip onboarding" });
    }
  });

  app.get("/api/reminders/settings", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getReminderSettings(userId);
      res.json(settings || {
        dailyReminderEnabled: false,
        dailyReminderTime: "18:00",
        weeklySummaryEnabled: false,
        weeklySummaryDay: 0,
        weeklySummaryTime: "09:00",
        timezone: "America/New_York",
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reminder settings" });
    }
  });

  app.put("/api/reminders/settings", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      const { dailyReminderEnabled, dailyReminderTime, weeklySummaryEnabled, weeklySummaryDay, weeklySummaryTime, timezone } = req.body;

      if (dailyReminderTime && !timeRegex.test(dailyReminderTime)) {
        return res.status(400).json({ message: "Invalid daily reminder time format (expected HH:MM)" });
      }
      if (weeklySummaryTime && !timeRegex.test(weeklySummaryTime)) {
        return res.status(400).json({ message: "Invalid weekly summary time format (expected HH:MM)" });
      }
      if (weeklySummaryDay !== undefined && (weeklySummaryDay < 0 || weeklySummaryDay > 6)) {
        return res.status(400).json({ message: "Weekly summary day must be 0-6 (Sunday-Saturday)" });
      }
      if (timezone) {
        try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); } catch {
          return res.status(400).json({ message: "Invalid timezone" });
        }
      }

      const settings = await storage.upsertReminderSettings(userId, {
        dailyReminderEnabled: !!dailyReminderEnabled,
        dailyReminderTime: dailyReminderTime || "18:00",
        weeklySummaryEnabled: !!weeklySummaryEnabled,
        weeklySummaryDay: weeklySummaryDay ?? 0,
        weeklySummaryTime: weeklySummaryTime || "09:00",
        timezone: timezone || "America/New_York",
      });
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: "Failed to update reminder settings" });
    }
  });

  app.post("/api/internal/run-reminders", async (req, res) => {
    const authHeader = req.headers["x-internal-secret"];
    const secret = process.env.SESSION_SECRET;
    if (!secret || authHeader !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const results = await runAllReminders();
      res.json(results);
    } catch (err) {
      console.error("Run reminders error:", err);
      res.status(500).json({ message: "Failed to run reminders" });
    }
  });

  // Lesson Logs
  app.get("/api/lesson-logs", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters: any = {};
      if (req.query.studentId) filters.studentId = Number(req.query.studentId);
      if (req.query.startDate) filters.startDate = req.query.startDate;
      if (req.query.endDate) filters.endDate = req.query.endDate;
      if (req.query.subjectName) filters.subjectName = req.query.subjectName;
      if (req.query.tag) filters.tag = req.query.tag;
      const logs = await storage.getLessonLogs(userId, filters);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch lesson logs" });
    }
  });

  app.get("/api/lesson-logs/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const log = await storage.getLessonLog(Number(req.params.id), userId);
    if (!log) return res.status(404).json({ message: "Lesson log not found" });
    res.json(log);
  });

  app.post("/api/lesson-logs", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertLessonLogSchema.parse({ ...req.body, userId });
      const student = await storage.getStudent(validated.studentId, userId);
      if (!student) return res.status(403).json({ message: "Access denied" });
      const log = await storage.createLessonLog(validated);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create lesson log" });
    }
  });

  app.put("/api/lesson-logs/:id", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (req.body.studentId) {
        const student = await storage.getStudent(Number(req.body.studentId), userId);
        if (!student) return res.status(403).json({ message: "Access denied" });
      }
      const log = await storage.updateLessonLog(Number(req.params.id), userId, req.body);
      if (!log) return res.status(404).json({ message: "Lesson log not found" });
      res.json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update lesson log" });
    }
  });

  app.delete("/api/lesson-logs/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const deleted = await storage.deleteLessonLog(Number(req.params.id), userId);
    if (!deleted) return res.status(404).json({ message: "Lesson log not found" });
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
        // Store student session (need both studentId and userId for evidence uploads)
        (req.session as any).studentId = student.id;
        (req.session as any).userId = student.userId;
        
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

  // Get student reading progress
  app.get("/api/student-portal/reading-progress", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const progress = await storage.getReadingProgressForStudent(studentId);
      res.json(progress);
    } catch (error) {
      console.error("Reading progress error:", error);
      res.status(500).json({ message: "Failed to load reading progress" });
    }
  });

  // Get reading progress for specific book
  app.get("/api/student-portal/reading-progress/:gutenbergId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const gutenbergId = parseInt(req.params.gutenbergId);
    
    try {
      const progress = await storage.getReadingProgress(studentId, gutenbergId);
      res.json(progress || null);
    } catch (error) {
      console.error("Reading progress error:", error);
      res.status(500).json({ message: "Failed to load reading progress" });
    }
  });

  // Save reading progress
  app.post("/api/student-portal/reading-progress", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const { gutenbergId, bookTitle, bookAuthor, currentChapter, chapterCount, scrollPosition, isComplete } = req.body;
    
    if (!gutenbergId || !bookTitle) {
      return res.status(400).json({ message: "gutenbergId and bookTitle are required" });
    }
    
    try {
      const progress = await storage.upsertReadingProgress({
        studentId,
        gutenbergId,
        bookTitle,
        bookAuthor,
        currentChapter: currentChapter ?? 0,
        chapterCount: chapterCount ?? 1,
        scrollPosition: scrollPosition ?? 0,
        isComplete: isComplete ?? false,
        lastReadAt: new Date(),
      });
      res.json(progress);
    } catch (error) {
      console.error("Reading progress save error:", error);
      res.status(500).json({ message: "Failed to save reading progress" });
    }
  });

  // Get book content from Gutenberg (proxied for students)
  app.get("/api/student-portal/gutenberg-content/:gutenbergId", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const gutenbergId = req.params.gutenbergId;
    try {
      // Try plain text first
      const textUrl = `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
      const response = await fetch(textUrl);
      
      if (response.ok) {
        const text = await response.text();
        res.json({ content: text, format: 'text' });
      } else {
        res.status(404).json({ message: "Book content not found" });
      }
    } catch (error) {
      console.error("Gutenberg content error:", error);
      res.status(500).json({ message: "Failed to fetch book content" });
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

  // Get evidence for a lesson (student view) - supports lessonId or classLessonId query params
  app.get("/api/student-portal/evidence", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    const lessonId = req.query.lessonId ? parseInt(req.query.lessonId as string) : undefined;
    const classLessonId = req.query.classLessonId ? parseInt(req.query.classLessonId as string) : undefined;
    
    if (!lessonId && !classLessonId) {
      return res.status(400).json({ message: "lessonId or classLessonId required" });
    }
    
    try {
      if (classLessonId) {
        // Verify student is enrolled in the class for this class lesson
        const [classLesson] = await db.select().from(classLessons)
          .where(eq(classLessons.id, classLessonId));
        
        if (!classLesson) {
          return res.status(404).json({ message: "Class lesson not found" });
        }
        
        // Check student is enrolled in the class
        const [enrollment] = await db.select().from(classEnrollments)
          .where(and(
            eq(classEnrollments.classId, classLesson.classId),
            eq(classEnrollments.studentId, studentId)
          ));
        
        if (!enrollment) {
          return res.status(403).json({ message: "Not enrolled in this class" });
        }
        
        // Get evidence for this class lesson uploaded by this student
        const evidence = await db.select().from(evidenceUploads)
          .where(and(
            eq(evidenceUploads.classLessonId, classLessonId),
            eq(evidenceUploads.studentId, studentId)
          ))
          .orderBy(evidenceUploads.createdAt);
        return res.json(evidence);
      }
      
      // Get evidence for a regular lesson
      const evidence = await storage.getEvidenceForLesson(lessonId!, studentId);
      res.json(evidence);
    } catch (error) {
      res.status(500).json({ message: "Failed to get evidence" });
    }
  });
  
  // Get evidence for a lesson (student view) - path param version (deprecated)
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

  // Student can get their enrolled co-op class lessons/assignments
  app.get("/api/student-portal/class-lessons", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const lessons = await storage.getStudentClassLessons(studentId);
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching class lessons:", error);
      res.status(500).json({ message: "Failed to load class lessons" });
    }
  });

  // Student can upload proof to a co-op class lesson
  app.post("/api/student-portal/class-lesson-evidence", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const schema = z.object({
        classLessonId: z.number().int().positive(),
        fileUrl: z.string().url(),
        fileType: z.string(),
        fileName: z.string().optional(),
        fileSize: z.number().optional(),
        title: z.string().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
      }
      
      // Verify student is enrolled in the class for this lesson
      const lesson = await storage.getClassLesson(parsed.data.classLessonId);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      
      const enrollments = await storage.getClassEnrollments(lesson.classId);
      const isEnrolled = enrollments.some(e => e.studentId === studentId && e.status === 'active');
      if (!isEnrolled) {
        return res.status(403).json({ message: "Not enrolled in this class" });
      }
      
      // Get student to get userId
      const [student] = await db.select().from(students).where(eq(students.id, studentId));
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Create evidence linked to class lesson with sharedWithTeacher=true by default
      const evidence = await storage.createEvidenceUpload({
        classLessonId: parsed.data.classLessonId,
        studentId,
        userId: student.userId,
        fileUrl: parsed.data.fileUrl,
        fileType: parsed.data.fileType,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        title: parsed.data.title || lesson.title,
        uploadedBy: 'student',
        sharedWithTeacher: true, // Default: visible to teacher for co-op assignments
        reviewStatus: 'pending'
      });
      
      res.json(evidence);
    } catch (error) {
      console.error("Error uploading class lesson evidence:", error);
      res.status(500).json({ message: "Failed to upload evidence" });
    }
  });

  // Student can browse their portfolio items (read-only)
  app.get("/api/student-portal/portfolio", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      // Get student to find userId
      const [student] = await db.select().from(students).where(eq(students.id, studentId));
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Get all evidence for this student
      const evidence = await storage.getEvidenceUploads(student.userId, { studentId });
      
      // Enrich with labels
      const enrichedEvidence = await Promise.all(evidence.map(async (e) => {
        const labels = await storage.getEvidenceLabels(e.id);
        return {
          ...e,
          labels,
        };
      }));
      
      res.json(enrichedEvidence);
    } catch (error) {
      console.error("Error fetching student portfolio:", error);
      res.status(500).json({ message: "Failed to load portfolio" });
    }
  });

  // Student can get their own QR code for uploading work
  app.get("/api/student-portal/qr-code", async (req: any, res) => {
    const studentId = req.session?.studentId;
    if (!studentId) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      const [student] = await db.select().from(students).where(eq(students.id, studentId));
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Generate token if not exists
      let token = student.uploadToken;
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
      console.error("Error generating student QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
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
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "not-configured",
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a friendly, patient, and encouraging AI tutor named "Study Helper" designed for elementary and middle school homeschool students. You follow the Charlotte Mason philosophy of education: teaching should be gentle, engaging, and spark curiosity.

CORE IDENTITY:
- You are like a kind older friend or tutor who loves helping kids learn
- Always G-rated and appropriate for children ages 5-14
- Never discuss violence, inappropriate content, politics, or anything unsuitable for children
- If asked about inappropriate topics, gently redirect: "That's not something I can help with, but I'd love to help you with your schoolwork! Do you have any questions about reading, writing, or math?"

MATH TUTORING:
- When solving math problems, ALWAYS show step-by-step instructions
- Break complex problems into small, numbered steps
- Use simple language like "First, let's..." "Next, we..." "Finally..."
- Include the answer at the end clearly labeled
- For word problems, help identify what information is given and what we need to find
- Encourage mental math strategies and number sense
- Example format:
  "Let's solve 24 + 38 step by step:
   Step 1: Add the ones place: 4 + 8 = 12 (write down 2, carry the 1)
   Step 2: Add the tens place: 2 + 3 = 5, plus the 1 we carried = 6
   The answer is 62! Great job working through it!"

WRITING HELP:
- Suggest creative, age-appropriate writing prompts when asked
- Help with story ideas, characters, and plot development
- Provide gentle spelling help - teach the correct spelling and a memory trick if helpful
- For grammar questions, explain rules simply with examples
- Encourage descriptive writing using the five senses
- Writing prompt ideas: adventures, animals, seasons, family, friendship, imagination

SPELLING & VOCABULARY:
- When asked about spelling, provide the correct spelling clearly
- Include a simple memory trick or word pattern when helpful
- Define words in simple terms with examples kids can relate to
- Suggest related words to build vocabulary

READING HELP:
- Summarize stories in kid-friendly language
- Help with reading comprehension questions
- Explain difficult words or concepts from their reading
- Ask engaging questions to spark thinking about what they read

GENERAL GUIDELINES:
- Use simple, age-appropriate language (aim for 3rd-5th grade reading level)
- Keep answers helpful but not overwhelming (2-4 short paragraphs usually)
- Be encouraging: "Great question!" "You're thinking like a scientist!" "You've got this!"
- Use examples children can relate to (animals, games, food, family, nature)
- If the student seems stuck, offer hints rather than just giving answers
- Celebrate effort: "I can tell you're working hard on this!"
- For Siri-style quick questions (time, weather, simple facts), give brief, direct answers

The student's name is ${studentName || "friend"}. Use their name occasionally to be friendly and personal.`
          },
          {
            role: "user",
            content: question
          }
        ],
        max_completion_tokens: 800,
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
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "not-configured",
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
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "not-configured",
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

  app.get("/api/portfolio/timeline", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
      const startDate = req.query.start as string | undefined;
      const endDate = req.query.end as string | undefined;
      const subject = req.query.subject as string | undefined;
      const tag = req.query.tag as string | undefined;
      const hasEvidence = req.query.hasEvidence === "true" ? true : req.query.hasEvidence === "false" ? false : undefined;

      const logs = await storage.getLessonLogs(userId, {
        studentId,
        startDate,
        endDate,
        subjectName: subject,
        tag,
      });

      const evidenceFilters: { studentId?: number; reviewStatus?: string } = {};
      if (studentId) evidenceFilters.studentId = studentId;
      const allEvidence = await storage.getEvidenceUploads(userId, evidenceFilters);

      const filteredEvidence = allEvidence.filter(e => {
        if (startDate && e.createdAt && new Date(e.createdAt) < new Date(startDate)) return false;
        if (endDate && e.createdAt && new Date(e.createdAt) > new Date(endDate + "T23:59:59")) return false;
        return true;
      });

      const evidenceByStudentDate: Record<string, typeof filteredEvidence> = {};
      filteredEvidence.forEach(e => {
        const dateKey = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : "unknown";
        const key = `${e.studentId}-${dateKey}`;
        if (!evidenceByStudentDate[key]) evidenceByStudentDate[key] = [];
        evidenceByStudentDate[key].push(e);
      });

      const logsWithEvidence = logs.map(log => {
        const key = `${log.studentId}-${log.date}`;
        const matched = evidenceByStudentDate[key] || [];
        return { ...log, evidence: matched };
      });

      const logStudentDates = new Set(logs.map(l => `${l.studentId}-${l.date}`));
      const orphanEvidence = filteredEvidence.filter(e => {
        const dateKey = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : "unknown";
        return !logStudentDates.has(`${e.studentId}-${dateKey}`);
      });

      let result = hasEvidence === true
        ? logsWithEvidence.filter(l => l.evidence.length > 0)
        : hasEvidence === false
        ? logsWithEvidence.filter(l => l.evidence.length === 0)
        : logsWithEvidence;

      res.json({
        logs: result,
        orphanEvidence: hasEvidence === false ? [] : orphanEvidence,
      });
    } catch (error) {
      console.error("Portfolio timeline error:", error);
      res.status(500).json({ message: "Failed to load portfolio timeline" });
    }
  });

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

  // Get pending evidence for review queue - MUST be before :id route
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

  app.get("/api/portfolio/evidence/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const evidence = await storage.getEvidenceUpload(id, userId);
    if (!evidence) return res.status(404).json({ message: "Evidence not found" });
    res.json(evidence);
  });

  app.post("/api/evidence/presign", protect, async (req: any, res) => {
    try {
      const { fileName, contentType } = req.body;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/wav', 'video/mp4'];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "File type not allowed" });
      }
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      res.json({ uploadUrl, objectPath });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({ message: "Failed to prepare upload" });
    }
  });

  // Parent can also upload evidence on behalf of student
  app.post("/api/portfolio/evidence", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const { studentId, lessonId } = req.body;
      
      // Validate student access
      if (studentId) {
        const canAccess = await storage.canAccessStudent(userId, studentId);
        if (!canAccess) {
          return res.status(403).json({ message: "Access denied to this student" });
        }
      }
      
      // Validate lesson access if provided
      if (lessonId) {
        const canAccessLes = await storage.canAccessLesson(userId, lessonId);
        if (!canAccessLes) {
          return res.status(403).json({ message: "Access denied to this lesson" });
        }
      }
      
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

  // Get or create share token for a student's portfolio
  app.get("/api/portfolio/share-token/:studentId", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = parseInt(req.params.studentId);
    
    try {
      // Verify user owns this student
      const student = await storage.getStudent(studentId, userId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const shareToken = await storage.getOrCreatePortfolioShareToken(studentId, userId);
      res.json({ token: shareToken.token });
    } catch (error) {
      console.error("Error getting share token:", error);
      res.status(500).json({ message: "Failed to get share token" });
    }
  });

  // Public portfolio view by share token (no auth required)
  app.get("/api/public/portfolio/:token", async (req, res) => {
    const { token } = req.params;
    
    try {
      const portfolio = await storage.getPortfolioByShareToken(token);
      
      if (!portfolio) {
        return res.status(404).json({ message: "Portfolio not found or link expired" });
      }
      
      // Return portfolio data (student name, evidence organized by labels)
      res.json({
        studentName: portfolio.student.name,
        studentAvatar: portfolio.student.avatar,
        labels: portfolio.labels,
        evidence: portfolio.evidence.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          fileUrl: e.fileUrl,
          fileType: e.fileType,
          fileName: e.fileName,
          createdAt: e.createdAt,
          labels: e.labels.map(l => ({ id: l.id, name: l.name, color: l.color }))
        }))
      });
    } catch (error) {
      console.error("Error fetching public portfolio:", error);
      res.status(500).json({ message: "Failed to load portfolio" });
    }
  });

  // Share Links - CRUD
  app.post("/api/share-links", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studentId, startDate, endDate, expiresAt, password, allowDownload } = req.body;

      if (!studentId) return res.status(400).json({ message: "studentId is required" });
      const student = await storage.getStudent(Number(studentId), userId);
      if (!student) return res.status(403).json({ message: "Access denied" });

      const token = crypto.randomBytes(32).toString("hex");
      let passwordHash: string | null = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      let expDate: Date | null = null;
      if (expiresAt) {
        expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) return res.status(400).json({ message: "Invalid expiresAt date" });
      }

      const link = await storage.createShareLink({
        userId,
        studentId: Number(studentId),
        token,
        passwordHash,
        expiresAt: expDate,
        startDate: startDate || null,
        endDate: endDate || null,
        allowDownload: allowDownload ?? true,
      });

      const { passwordHash: _ph, ...linkWithoutHash } = link;
      res.status(201).json({
        link: linkWithoutHash,
        password: password || null,
      });
    } catch (err) {
      console.error("Create share link error:", err);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.get("/api/share-links", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const links = await storage.getShareLinks(userId);
      res.json(links.map(l => ({ ...l, passwordHash: undefined, hasPassword: !!l.passwordHash })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  app.post("/api/share-links/:id/revoke", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ok = await storage.revokeShareLink(Number(req.params.id), userId);
      if (!ok) return res.status(404).json({ message: "Share link not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to revoke share link" });
    }
  });

  app.delete("/api/share-links/:id", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ok = await storage.deleteShareLink(Number(req.params.id), userId);
      if (!ok) return res.status(404).json({ message: "Share link not found" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete share link" });
    }
  });

  // Public share route (no auth required)
  app.get("/api/share/:token", async (req, res) => {
    try {
      const link = await storage.getShareLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Share link not found" });
      if (link.revokedAt) return res.status(410).json({ message: "This link is no longer active.", status: "revoked" });
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "This link has expired.", status: "expired" });

      if (link.passwordHash) {
        const sessionKey = `share_verified_${link.token}`;
        if (!(req as any).session?.[sessionKey]) {
          return res.json({ requiresPassword: true, studentName: null });
        }
      }

      const [student] = await db.select().from(students).where(eq(students.id, link.studentId));
      if (!student) return res.status(404).json({ message: "Student not found" });

      const filters: any = { studentId: link.studentId };
      if (link.startDate) filters.startDate = link.startDate;
      if (link.endDate) filters.endDate = link.endDate;

      const logs = await storage.getLessonLogs(link.userId, filters);

      const evidenceFilters: any = { studentId: link.studentId };
      const allEvidence = await storage.getEvidenceUploads(link.userId, evidenceFilters);

      const evidenceByKey: Record<string, typeof allEvidence> = {};
      for (const e of allEvidence) {
        if (e.reviewStatus !== "approved") continue;
        const dateKey = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : "";
        const key = `${e.studentId}-${dateKey}`;
        if (!evidenceByKey[key]) evidenceByKey[key] = [];
        evidenceByKey[key].push(e);
      }

      const logsWithEvidence = logs.map(log => {
        const key = `${log.studentId}-${log.date}`;
        const evidence = (evidenceByKey[key] || []).map(e => {
          if (!link.allowDownload) {
            const { fileUrl, ...rest } = e;
            return rest;
          }
          return e;
        });
        return { ...log, evidence };
      });

      res.json({
        studentName: student.name,
        studentAvatar: student.avatar,
        startDate: link.startDate,
        endDate: link.endDate,
        allowDownload: link.allowDownload,
        logs: logsWithEvidence,
      });
    } catch (err) {
      console.error("Public share error:", err);
      res.status(500).json({ message: "Failed to load shared portfolio" });
    }
  });

  const sharePasswordAttempts = new Map<string, { count: number; lastAttempt: number }>();
  app.post("/api/share/:token/verify-password", async (req: any, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      const attemptsKey = token;
      const attempts = sharePasswordAttempts.get(attemptsKey);
      if (attempts && attempts.count >= 5 && Date.now() - attempts.lastAttempt < 60000) {
        return res.status(429).json({ message: "Too many attempts. Try again in a minute." });
      }

      const link = await storage.getShareLinkByToken(token);
      if (!link) return res.status(404).json({ message: "Share link not found" });
      if (link.revokedAt) return res.status(410).json({ message: "This link is no longer active." });
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).json({ message: "This link has expired." });
      if (!link.passwordHash) return res.json({ success: true });

      const valid = await bcrypt.compare(password || "", link.passwordHash);
      if (!valid) {
        const prev = sharePasswordAttempts.get(attemptsKey) || { count: 0, lastAttempt: 0 };
        sharePasswordAttempts.set(attemptsKey, { count: prev.count + 1, lastAttempt: Date.now() });
        return res.status(401).json({ message: "Incorrect password" });
      }

      sharePasswordAttempts.delete(attemptsKey);
      const sessionKey = `share_verified_${token}`;
      if (req.session) {
        req.session[sessionKey] = true;
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to verify password" });
    }
  });

  // Export portfolio as PDF
  app.get("/api/portfolio/export", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const title = (req.query.title as string) || "Student Learning Summary";
    const includeSummary = req.query.includeSummary !== "false";
    const includeLessons = req.query.includeLessons !== "false";
    const includeEvidence = req.query.includeEvidence !== "false";
    const includeMonthlyTotals = req.query.includeMonthlyTotals === "true";

    try {
      const allStudents = await storage.getStudents(userId);

      if (studentId && !allStudents.find(s => s.id === studentId)) {
        return res.status(403).json({ message: "Student not found or not authorized" });
      }

      const targetStudents = studentId
        ? allStudents.filter(s => s.id === studentId)
        : allStudents;

      if (targetStudents.length === 0) {
        return res.status(400).json({ message: "No students found" });
      }

      const logFilters: any = {};
      if (studentId) logFilters.studentId = String(studentId);
      if (startDate) logFilters.startDate = startDate;
      if (endDate) logFilters.endDate = endDate;

      const allLogs = await storage.getLessonLogs(userId, logFilters);

      if (allLogs.length > 500) {
        return res.status(400).json({
          message: `This export contains ${allLogs.length} lessons. Please narrow your date range to 500 lessons or fewer.`,
          count: allLogs.length,
        });
      }

      allLogs.sort((a, b) => a.date.localeCompare(b.date));

      let evidenceByStudent = new Map<number, any[]>();
      if (includeEvidence) {
        const evidence = await storage.getEvidenceUploads(userId, {
          studentId,
          reviewStatus: "approved",
        });
        for (const e of evidence) {
          const eDate = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : null;
          if (startDate && eDate && eDate < startDate) continue;
          if (endDate && eDate && eDate > endDate) continue;
          const arr = evidenceByStudent.get(e.studentId) || [];
          arr.push(e);
          evidenceByStudent.set(e.studentId, arr);
        }
      }

      const fetchImageBuffer = async (fileUrl: string): Promise<Buffer | null> => {
        try {
          if (!fileUrl.startsWith("/objects/")) return null;
          try {
            const objectFile = await objectStorageService.getObjectEntityFile(fileUrl);
            const [buffer] = await objectFile.download();
            return buffer;
          } catch {
            try {
              const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
              if (privateDir) {
                const pathParts = fileUrl.slice(1).split("/");
                const entityId = pathParts.slice(1).join("/");
                let entityDir = privateDir;
                if (!entityDir.endsWith("/")) entityDir += "/";
                const fullObjectPath = `${entityDir}${entityId}`;
                const parts = fullObjectPath.startsWith("/")
                  ? fullObjectPath.slice(1).split("/")
                  : fullObjectPath.split("/");
                if (parts.length >= 2) {
                  const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
                  const bucket = objectStorageClient.bucket(parts[0]);
                  const file = bucket.file(parts.slice(1).join("/"));
                  const [exists] = await file.exists();
                  if (exists) {
                    const [buffer] = await file.download();
                    return buffer;
                  }
                }
              }
            } catch {}
          }
          return null;
        } catch {
          return null;
        }
      };

      const selectedStudent = studentId ? targetStudents[0] : undefined;
      const dateRangeStr = startDate && endDate
        ? `${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : startDate
          ? `From ${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : endDate
            ? `Through ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : "All Time";

      let filename = "learning_summary";
      if (selectedStudent) filename += `_${selectedStudent.name.replace(/\s+/g, "_")}`;
      filename += `_${new Date().toISOString().split("T")[0]}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const doc = new PDFDocument({
        size: "letter",
        margins: { top: 50, bottom: 60, left: 55, right: 55 },
        bufferPages: true,
      });
      doc.pipe(res);

      const pageW = 612;
      const contentW = pageW - 110;
      const leftM = 55;
      let pageNumber = 0;

      const addFooter = () => {
        pageNumber++;
        if (pageNumber > 1) {
          doc.fontSize(8).font("Helvetica").fillColor("#a0aec0");
          doc.text(`${pageNumber}`, 0, 740, { align: "center", width: pageW });
        }
      };

      // ===== COVER PAGE =====
      doc.moveDown(6);
      doc.fontSize(32).font("Helvetica-Bold").fillColor("#1a1a1a").text(title, { align: "center" });
      doc.moveDown(0.3);
      doc.strokeColor("#333333").lineWidth(1).moveTo(180, doc.y).lineTo(432, doc.y).stroke();
      doc.moveDown(2);

      if (selectedStudent) {
        doc.fontSize(22).font("Helvetica").fillColor("#333333").text(selectedStudent.name, { align: "center" });
      } else {
        doc.fontSize(18).font("Helvetica").fillColor("#333333").text(targetStudents.map(s => s.name).join(", "), { align: "center" });
      }
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica").fillColor("#666666").text(dateRangeStr, { align: "center" });
      doc.moveDown(4);
      doc.fontSize(10).fillColor("#999999").text(
        `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        { align: "center" }
      );
      doc.moveDown(10);
      doc.fontSize(8).fillColor("#bbbbbb").text("Generated with Lesson Logger", { align: "center" });

      addFooter();

      // ===== SUMMARY PAGE =====
      if (includeSummary) {
        doc.addPage();
        addFooter();

        doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a1a1a").text("Summary");
        doc.moveDown(0.3);
        doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y).stroke();
        doc.moveDown(1);

        const totalMinutes = allLogs.reduce((s, l) => s + l.durationMinutes, 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const remainMins = totalMinutes % 60;
        const totalEvidenceCount = Array.from(evidenceByStudent.values()).reduce((s, arr) => s + arr.length, 0);

        doc.fontSize(12).font("Helvetica").fillColor("#333333");
        doc.text(`Total Lessons Logged: ${allLogs.length}`);
        doc.text(`Total Time: ${totalHours}h ${remainMins}m`);
        if (includeEvidence && totalEvidenceCount > 0) {
          doc.text(`Evidence Items: ${totalEvidenceCount}`);
        }
        doc.moveDown(1.5);

        const subjectMap = new Map<string, { lessons: number; minutes: number }>();
        for (const log of allLogs) {
          const entry = subjectMap.get(log.subjectName) || { lessons: 0, minutes: 0 };
          entry.lessons++;
          entry.minutes += log.durationMinutes;
          subjectMap.set(log.subjectName, entry);
        }

        const sortedSubjects = Array.from(subjectMap.entries()).sort((a, b) => b[1].minutes - a[1].minutes);

        if (sortedSubjects.length > 0) {
          doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text("Subject Breakdown");
          doc.moveDown(0.5);

          const colX = [leftM, leftM + 200, leftM + 280];
          doc.fontSize(10).font("Helvetica-Bold").fillColor("#666666");
          doc.text("Subject", colX[0], doc.y, { width: 190 });
          doc.text("Lessons", colX[1], doc.y - 12, { width: 70, align: "right" });
          doc.text("Time", colX[2], doc.y - 12, { width: 80, align: "right" });
          doc.moveDown(0.3);
          doc.strokeColor("#e0e0e0").lineWidth(0.5).moveTo(leftM, doc.y).lineTo(leftM + 320, doc.y).stroke();
          doc.moveDown(0.3);

          doc.font("Helvetica").fillColor("#333333");
          for (const [subj, data] of sortedSubjects) {
            const h = Math.floor(data.minutes / 60);
            const m = data.minutes % 60;
            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
            const rowY = doc.y;
            doc.fontSize(10).text(subj, colX[0], rowY, { width: 190 });
            doc.text(String(data.lessons), colX[1], rowY, { width: 70, align: "right" });
            doc.text(timeStr, colX[2], rowY, { width: 80, align: "right" });
            doc.moveDown(0.2);
          }
        }
      }

      // ===== CHRONOLOGICAL LEARNING LOG =====
      if (includeLessons && allLogs.length > 0) {
        const monthGroups = new Map<string, typeof allLogs>();
        for (const log of allLogs) {
          const d = new Date(log.date + "T00:00:00");
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const arr = monthGroups.get(key) || [];
          arr.push(log);
          monthGroups.set(key, arr);
        }

        const sortedMonths = Array.from(monthGroups.keys()).sort();
        let embeddedImageCount = 0;
        const maxEmbeddedImages = 100;

        for (const monthKey of sortedMonths) {
          const monthLogs = monthGroups.get(monthKey)!;

          doc.addPage();
          addFooter();

          const [y, m] = monthKey.split("-");
          const monthLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

          doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a1a1a").text(monthLabel);
          doc.moveDown(0.2);
          doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y).stroke();
          doc.moveDown(0.8);

          for (const log of monthLogs) {
            if (doc.y > 660) {
              doc.addPage();
              addFooter();
              doc.fontSize(10).font("Helvetica").fillColor("#999999").text(`${monthLabel} (continued)`);
              doc.moveDown(0.5);
            }

            const logDate = new Date(log.date + "T00:00:00");
            const dateStr = logDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const h = Math.floor(log.durationMinutes / 60);
            const mins = log.durationMinutes % 60;
            const durStr = h > 0 ? `${h}h ${mins}m` : `${mins}m`;

            doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a");
            doc.text(`${dateStr} — ${log.subjectName} (${durStr})`);

            if (log.title) {
              doc.fontSize(10).font("Helvetica").fillColor("#444444").text(log.title);
            }

            if (log.notes) {
              const clampedNotes = log.notes.length > 400 ? log.notes.substring(0, 397) + "..." : log.notes;
              doc.fontSize(9).font("Helvetica").fillColor("#666666").text(clampedNotes, { width: contentW });
            }

            if (includeEvidence) {
              const studentEvidence = evidenceByStudent.get(log.studentId) || [];
              const matchingEvidence = studentEvidence.filter(e => {
                const eDate = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : null;
                return eDate === log.date;
              });

              const imageEvidence = matchingEvidence.filter(
                (e: any) => e.fileType === "image" && e.fileUrl
              ).slice(0, 4);
              const nonImageEvidence = matchingEvidence.filter(
                (e: any) => e.fileType !== "image"
              );

              if (imageEvidence.length > 0 && embeddedImageCount < maxEmbeddedImages) {
                doc.moveDown(0.3);
                let imgX = leftM;
                const thumbSize = 120;
                const maxPerRow = Math.min(imageEvidence.length, 4);

                for (const ev of imageEvidence.slice(0, maxPerRow)) {
                  if (embeddedImageCount >= maxEmbeddedImages) break;

                  if (doc.y + thumbSize + 20 > 680) {
                    doc.addPage();
                    addFooter();
                    doc.fontSize(10).font("Helvetica").fillColor("#999999").text(`${monthLabel} (continued)`);
                    doc.moveDown(0.5);
                    imgX = leftM;
                  }

                  try {
                    const buf = await fetchImageBuffer(ev.fileUrl);
                    if (buf) {
                      doc.image(buf, imgX, doc.y, { fit: [thumbSize, thumbSize] });
                      imgX += thumbSize + 8;
                      embeddedImageCount++;
                    }
                  } catch {}
                }

                if (imageEvidence.length > 0) {
                  doc.y += thumbSize + 4;
                }
              }

              for (const nev of nonImageEvidence) {
                doc.fontSize(8).font("Helvetica").fillColor("#888888");
                doc.text(`Attachment: ${(nev as any).fileName || "file"}`);
              }
            }

            doc.moveDown(0.3);
            doc.strokeColor("#eeeeee").lineWidth(0.3).moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y).stroke();
            doc.moveDown(0.5);
          }

          if (includeMonthlyTotals) {
            doc.moveDown(0.5);
            const mTotal = monthLogs.reduce((s, l) => s + l.durationMinutes, 0);
            const mh = Math.floor(mTotal / 60);
            const mm = mTotal % 60;
            const mSubjects = new Set(monthLogs.map(l => l.subjectName));

            doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y).stroke();
            doc.moveDown(0.3);
            doc.fontSize(10).font("Helvetica-Bold").fillColor("#444444");
            doc.text(`${monthLabel} Totals: ${monthLogs.length} lessons, ${mh}h ${mm}m`);
            doc.fontSize(9).font("Helvetica").fillColor("#666666");
            doc.text(`Subjects: ${Array.from(mSubjects).join(", ")}`);
          }
        }
      }

      // ===== EMPTY STATE =====
      if (allLogs.length === 0) {
        doc.addPage();
        addFooter();
        doc.moveDown(6);
        doc.fontSize(14).fillColor("#666666").text("No lesson logs found for the selected filters.", { align: "center" });
        doc.moveDown(1);
        doc.fontSize(11).fillColor("#999999").text("Log lessons first, then come back to export your summary.", { align: "center" });
      }

      // ===== FINAL FOOTER =====
      doc.addPage();
      addFooter();
      doc.moveDown(8);
      doc.fontSize(14).font("Helvetica").fillColor("#999999").text("End of Summary", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#bbbbbb").text("Generated with Lesson Logger", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate PDF" });
      }
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

  // ============== Organization Management Endpoints ==============

  // Get all organizations user belongs to
  app.get("/api/organizations", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgs = await storage.getOrganizations(userId);
    res.json(orgs);
  });

  // Get single organization with user's role
  app.get("/api/organizations/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const org = await storage.getOrganization(id, userId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found or access denied" });
    }
    const role = await storage.getUserRoleInOrg(userId, id);
    res.json({ ...org, userRole: role });
  });

  // Create new organization (user becomes owner)
  app.post("/api/organizations", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Organization name is required" });
    }
    const org = await storage.createOrganization({ name, description }, userId);
    res.status(201).json(org);
  });

  // Update organization (owner only)
  app.patch("/api/organizations/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const updates = req.body;
    const updated = await storage.updateOrganization(id, userId, updates);
    if (!updated) {
      return res.status(403).json({ message: "Not authorized to update this organization" });
    }
    res.json(updated);
  });

  // Delete organization (owner only)
  app.delete("/api/organizations/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    const deleted = await storage.deleteOrganization(id, userId);
    if (!deleted) {
      return res.status(403).json({ message: "Not authorized to delete this organization" });
    }
    res.json({ message: "Organization deleted" });
  });

  // Request presigned URL for organization logo upload (owner only)
  app.post("/api/organizations/:id/logo-upload-url", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orgId = Number(req.params.id);
      
      const role = await storage.getUserRoleInOrg(userId, orgId);
      if (role !== 'owner') {
        return res.status(403).json({ message: "Only organization owners can upload logos" });
      }
      
      const org = await storage.getOrganization(orgId, userId);
      if (!org?.isCoopAccount) {
        return res.status(403).json({ message: "Logo upload is only available for co-op accounts" });
      }
      
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating logo upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Update organization logo after upload (owner only)
  app.patch("/api/organizations/:id/logo", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.id);
    const { logoUrl } = req.body;
    
    if (!logoUrl) {
      return res.status(400).json({ message: "Logo URL is required" });
    }
    
    // Validate logoUrl is from our object storage path
    if (typeof logoUrl !== 'string' || !logoUrl.startsWith('/objects/')) {
      return res.status(400).json({ message: "Invalid logo URL format" });
    }
    
    const role = await storage.getUserRoleInOrg(userId, orgId);
    if (role !== 'owner') {
      return res.status(403).json({ message: "Only organization owners can update logos" });
    }
    
    const org = await storage.getOrganization(orgId, userId);
    if (!org?.isCoopAccount) {
      return res.status(403).json({ message: "Logo upload is only available for co-op accounts" });
    }
    
    const updated = await storage.updateOrganization(orgId, userId, { logoUrl });
    if (!updated) {
      return res.status(500).json({ message: "Failed to update logo" });
    }
    res.json(updated);
  });

  // Get organization memberships
  app.get("/api/organizations/:id/members", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.id);
    const role = await storage.getUserRoleInOrg(userId, orgId);
    if (!role) {
      return res.status(403).json({ message: "Not a member of this organization" });
    }
    const members = await storage.getOrgMemberships(orgId);
    res.json(members);
  });

  // Invite/add member to organization (owner only)
  app.post("/api/organizations/:id/members", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.id);
    const { targetUserId, role, email } = req.body;
    
    const userRole = await storage.getUserRoleInOrg(userId, orgId);
    if (userRole !== 'owner') {
      return res.status(403).json({ message: "Only owners can invite members" });
    }
    
    if (!['teacher', 'parent'].includes(role)) {
      return res.status(400).json({ message: "Role must be 'teacher' or 'parent'" });
    }
    
    // If targetUserId provided, add directly; otherwise store invite for email
    if (targetUserId) {
      const existing = await storage.getOrgMembership(orgId, targetUserId);
      if (existing) {
        return res.status(400).json({ message: "User is already a member" });
      }
      const membership = await storage.createOrgMembership({
        organizationId: orgId,
        userId: targetUserId,
        role,
        status: 'pending',
      });
      res.status(201).json(membership);
    } else {
      // TODO: Handle email invites with pending status
      res.status(400).json({ message: "targetUserId required (email invites coming soon)" });
    }
  });

  // Update member role/permissions (owner only)
  app.patch("/api/organizations/:orgId/members/:memberId", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    const memberId = Number(req.params.memberId);
    
    const userRole = await storage.getUserRoleInOrg(userId, orgId);
    if (userRole !== 'owner') {
      return res.status(403).json({ message: "Only owners can update members" });
    }
    
    const { role, canViewAllWork, status } = req.body;
    const updates: any = {};
    if (role) updates.role = role;
    if (canViewAllWork !== undefined) updates.canViewAllWork = canViewAllWork;
    if (status) updates.status = status;
    
    const updated = await storage.updateOrgMembership(memberId, updates);
    res.json(updated);
  });

  // Remove member from organization (owner only)
  app.delete("/api/organizations/:orgId/members/:memberId", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    const memberId = Number(req.params.memberId);
    
    const userRole = await storage.getUserRoleInOrg(userId, orgId);
    if (userRole !== 'owner') {
      return res.status(403).json({ message: "Only owners can remove members" });
    }
    
    await storage.deleteOrgMembership(memberId);
    res.json({ message: "Member removed" });
  });

  // Get user's org memberships (for showing which orgs they belong to)
  app.get("/api/user/organizations", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const memberships = await storage.getUserOrgMemberships(userId);
    res.json(memberships);
  });

  // ============== Class Management Endpoints ==============

  // Get classes in organization
  app.get("/api/organizations/:orgId/classes", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    
    const role = await storage.getUserRoleInOrg(userId, orgId);
    if (!role) {
      return res.status(403).json({ message: "Not a member of this organization" });
    }
    
    const allClasses = await storage.getClasses(orgId);
    
    // Teachers only see their own classes
    if (role === 'teacher') {
      const myClasses = allClasses.filter(c => c.teacherUserId === userId);
      return res.json(myClasses);
    }
    
    res.json(allClasses);
  });

  // Get classes user teaches (across all orgs)
  app.get("/api/my-classes", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classes = await storage.getClassesForTeacher(userId);
    res.json(classes);
  });

  // Get single class
  app.get("/api/classes/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    
    const classData = await storage.getClass(id);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Check access: teacher of class or org member
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (!role && classData.teacherUserId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(classData);
  });

  // Create class (teacher or owner)
  app.post("/api/organizations/:orgId/classes", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    
    const role = await storage.getUserRoleInOrg(userId, orgId);
    if (!role || (role !== 'owner' && role !== 'teacher')) {
      return res.status(403).json({ message: "Only owners and teachers can create classes" });
    }
    
    const { name, description, gradeLevel, scheduledDays, startDate, endDate } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Class name is required" });
    }
    
    const classData = await storage.createClass({
      organizationId: orgId,
      teacherUserId: userId,
      name,
      description,
      gradeLevel,
      scheduledDays,
      startDate,
      endDate,
      isActive: true,
    });
    
    res.status(201).json(classData);
  });

  // Update class (teacher or owner)
  app.patch("/api/classes/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    
    const classData = await storage.getClass(id);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Only teacher of class or org owner can update
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (classData.teacherUserId !== userId && role !== 'owner') {
      return res.status(403).json({ message: "Not authorized to update this class" });
    }
    
    const updated = await storage.updateClass(id, req.body);
    res.json(updated);
  });

  // Delete class (owner only)
  app.delete("/api/classes/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const id = Number(req.params.id);
    
    const classData = await storage.getClass(id);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (role !== 'owner') {
      return res.status(403).json({ message: "Only owners can delete classes" });
    }
    
    await storage.deleteClass(id);
    res.json({ message: "Class deleted" });
  });

  // Get class enrollments
  app.get("/api/classes/:id/students", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.id);
    
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Only teacher or org member can see enrollments
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (!role && classData.teacherUserId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const enrollments = await storage.getClassEnrollments(classId);
    res.json(enrollments);
  });

  // Enroll student in class (teacher or owner)
  app.post("/api/classes/:id/students", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.id);
    
    // Validate request body
    const schema = z.object({ studentId: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid studentId" });
    }
    const { studentId } = parsed.data;
    
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (classData.teacherUserId !== userId && role !== 'owner') {
      return res.status(403).json({ message: "Not authorized to enroll students" });
    }
    
    // Verify student exists and belongs to same organization or parent
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // For org-based classes, student must belong to same organization
    if (classData.organizationId && student.organizationId !== classData.organizationId) {
      return res.status(403).json({ message: "Cannot enroll student from different organization" });
    }
    
    // User must have access to this student (parent owns, or teacher of a class with this student)
    const canAccess = await storage.canAccessStudent(userId, studentId);
    if (!canAccess) {
      return res.status(403).json({ message: "You don't have access to this student" });
    }
    
    const enrollment = await storage.enrollStudent(classId, studentId);
    res.status(201).json(enrollment);
  });

  // Unenroll student from class (teacher or owner)
  app.delete("/api/classes/:classId/students/:studentId", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    const studentId = Number(req.params.studentId);
    
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (classData.teacherUserId !== userId && role !== 'owner') {
      return res.status(403).json({ message: "Not authorized to unenroll students" });
    }
    
    await storage.unenrollStudent(classId, studentId);
    res.json({ message: "Student unenrolled" });
  });

  // ============== CLASS LESSONS (Teacher-created assignments for co-ops) ==============

  // Get all lessons for a class
  app.get("/api/classes/:classId/lessons", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Teacher, org member, or parent of enrolled student can view
    const role = await storage.getUserRoleInOrg(userId, classData.organizationId);
    if (!role && classData.teacherUserId !== userId) {
      // Check if parent has enrolled student
      const enrollments = await storage.getClassEnrollments(classId);
      let hasAccess = false;
      for (const e of enrollments) {
        if (await storage.canAccessStudent(userId, e.studentId)) {
          hasAccess = true;
          break;
        }
      }
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
    
    const lessons = await storage.getClassLessons(classId);
    res.json(lessons);
  });

  // Create class lesson (teacher only)
  app.post("/api/classes/:classId/lessons", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    // Validate request body
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      instructions: z.string().optional(),
      dueDate: z.string().optional(),
      requiresEvidence: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
    }
    
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    if (classData.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher can create lessons" });
    }
    
    const lesson = await storage.createClassLesson({
      ...parsed.data,
      classId,
      teacherUserId: userId
    });
    
    // Send email notifications to parents of enrolled students (async, don't block response)
    (async () => {
      try {
        const enrollments = await storage.getClassEnrollments(classId);
        for (const enrollment of enrollments) {
          // Get student and their parent's notification preferences
          const studentData = await db.select().from(students).where(eq(students.id, enrollment.studentId)).limit(1);
          if (!studentData[0]) continue;
          
          const parentUserId = studentData[0].userId;
          
          // Check notification preferences
          const [prefs] = await db.select().from(notificationPreferences)
            .where(and(
              eq(notificationPreferences.userId, parentUserId),
              eq(notificationPreferences.orgId, classData.organizationId)
            ));
          
          // Default to sending if no preferences set
          if (prefs && prefs.emailNewAssignment === false) continue;
          
          // Get parent email
          const [parentUser] = await db.select().from(users).where(eq(users.id, parentUserId));
          if (!parentUser?.email) continue;
          
          const emailContent = getNewAssignmentEmail({
            parentName: parentUser.firstName || 'Parent',
            studentName: studentData[0].name,
            assignmentTitle: lesson.title,
            className: classData.name,
            dueDate: parsed.data.dueDate,
            instructions: parsed.data.instructions
          });
          
          await sendEmail({
            to: parentUser.email,
            subject: emailContent.subject,
            html: emailContent.html
          });
        }
      } catch (emailError) {
        console.error('Failed to send new assignment notifications:', emailError);
      }
    })();
    
    res.json(lesson);
  });

  // Get single class lesson
  app.get("/api/class-lessons/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    const lesson = await storage.getClassLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    const canAccess = await storage.canAccessClassLesson(userId, lessonId);
    if (!canAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(lesson);
  });

  // Update class lesson (teacher only)
  app.patch("/api/class-lessons/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    // Validate request body (only allow specific fields)
    const schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      instructions: z.string().optional(),
      dueDate: z.string().optional(),
      requiresEvidence: z.boolean().optional(),
      isActive: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
    }
    
    const lesson = await storage.getClassLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    if (lesson.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher can update lessons" });
    }
    
    const updated = await storage.updateClassLesson(lessonId, parsed.data);
    res.json(updated);
  });

  // Delete class lesson (teacher only)
  app.delete("/api/class-lessons/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    const lesson = await storage.getClassLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    if (lesson.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher can delete lessons" });
    }
    
    await storage.deleteClassLesson(lessonId);
    res.json({ message: "Lesson deleted" });
  });

  // Get submissions for a class lesson (teacher only)
  app.get("/api/class-lessons/:id/submissions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const lessonId = Number(req.params.id);
    
    const lesson = await storage.getClassLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    
    // Only teacher can view all submissions
    if (lesson.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher can view submissions" });
    }
    
    const submissions = await storage.getClassLessonSubmissions(lessonId);
    
    // Also include feedback for each submission
    const submissionsWithFeedback = await Promise.all(submissions.map(async (sub) => {
      const feedback = await storage.getTeacherFeedback(sub.id);
      return { ...sub, feedback };
    }));
    
    res.json(submissionsWithFeedback);
  });

  // ============== TEACHER FEEDBACK ==============

  // Get feedback for evidence (visible to family and teacher)
  app.get("/api/portfolio/evidence/:id/feedback", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const evidenceId = Number(req.params.id);
    
    const canView = await storage.canViewEvidence(userId, evidenceId);
    if (!canView) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const feedback = await storage.getTeacherFeedback(evidenceId);
    res.json(feedback);
  });

  // Create feedback (teacher of linked class lesson only)
  app.post("/api/portfolio/evidence/:id/feedback", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const evidenceId = Number(req.params.id);
    
    // Validate request body
    const schema = z.object({
      feedback: z.string().min(1),
      grade: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Feedback is required", errors: parsed.error.errors });
    }
    
    const canFeedback = await storage.canGiveTeacherFeedback(userId, evidenceId);
    if (!canFeedback) {
      return res.status(403).json({ message: "Only the assigned teacher can provide feedback" });
    }
    
    const feedback = await storage.createTeacherFeedback({
      evidenceId,
      teacherUserId: userId,
      feedback: parsed.data.feedback,
      grade: parsed.data.grade
    });
    res.json(feedback);
  });

  // Update feedback (teacher who created it and still has access)
  app.patch("/api/portfolio/feedback/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const feedbackId = Number(req.params.id);
    
    // Validate request body
    const schema = z.object({
      feedback: z.string().min(1).optional(),
      grade: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
    }
    
    // Get the feedback to verify ownership
    const existing = await db.select().from(teacherFeedback)
      .where(eq(teacherFeedback.id, feedbackId));
    
    if (existing.length === 0) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    
    if (existing[0].teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher who created this feedback can update it" });
    }
    
    // Verify teacher still has access to the evidence
    const canFeedback = await storage.canGiveTeacherFeedback(userId, existing[0].evidenceId);
    if (!canFeedback) {
      return res.status(403).json({ message: "Access to this evidence has been revoked" });
    }
    
    const updated = await storage.updateTeacherFeedback(feedbackId, parsed.data);
    res.json(updated);
  });

  // Delete feedback (teacher who created it and still has access)
  app.delete("/api/portfolio/feedback/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const feedbackId = Number(req.params.id);
    
    const existing = await db.select().from(teacherFeedback)
      .where(eq(teacherFeedback.id, feedbackId));
    
    if (existing.length === 0) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    
    if (existing[0].teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher who created this feedback can delete it" });
    }
    
    // Verify teacher still has access to the evidence
    const canFeedback = await storage.canGiveTeacherFeedback(userId, existing[0].evidenceId);
    if (!canFeedback) {
      return res.status(403).json({ message: "Access to this evidence has been revoked" });
    }
    
    await storage.deleteTeacherFeedback(feedbackId);
    res.json({ message: "Feedback deleted" });
  });

  // ============== EVIDENCE SHARING CONTROLS ==============

  // Toggle evidence sharing with teacher (family owner only)
  app.patch("/api/portfolio/evidence/:id/sharing", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const evidenceId = Number(req.params.id);
    
    // Validate request body
    const schema = z.object({
      sharedWithTeacher: z.boolean()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "sharedWithTeacher boolean required", errors: parsed.error.errors });
    }
    
    // Use getEvidenceUploadById to get the evidence without role-based filtering
    const evidence = await storage.getEvidenceUploadById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }
    
    // Only the family owner (the userId who created the evidence) can toggle sharing
    if (evidence.userId !== userId) {
      return res.status(403).json({ message: "Only the family who owns this evidence can control sharing" });
    }
    
    const updated = await storage.updateEvidenceUpload(evidenceId, userId, {
      sharedWithTeacher: parsed.data.sharedWithTeacher
    });
    res.json(updated);
  });

  // Get evidence visible to teacher (for teacher dashboard)
  app.get("/api/teacher/evidence", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = req.query.classId ? Number(req.query.classId) : undefined;
    
    const evidence = await storage.getTeacherVisibleEvidence(userId, classId);
    res.json(evidence);
  });

  // Get accessible students based on role
  app.get("/api/accessible-students", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = req.query.organizationId ? Number(req.query.organizationId) : undefined;
    
    const studentIds = await storage.getAccessibleStudentIds(userId, orgId);
    
    // Fetch full student data
    const studentPromises = studentIds.map(id => 
      db.select().from(students).where(eq(students.id, id))
    );
    const results = await Promise.all(studentPromises);
    const studentList = results.map(r => r[0]).filter(Boolean);
    
    res.json(studentList);
  });

  // ============== CLASS SESSIONS & ATTENDANCE ==============

  // Get all sessions for a class (teacher only)
  app.get("/api/classes/:classId/sessions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    // Verify user is the teacher of this class
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Check if user is the teacher (via class lessons) or org owner
    const classLessonList = await storage.getClassLessons(classId);
    const isTeacher = classLessonList.some(l => l.teacherUserId === userId);
    const membership = await storage.getOrgMembership(classData.organizationId, userId);
    
    if (!isTeacher && membership?.role !== 'owner') {
      return res.status(403).json({ message: "Only the teacher or org owner can view sessions" });
    }
    
    const sessions = await db.select().from(classSessions)
      .where(eq(classSessions.classId, classId))
      .orderBy(classSessions.sessionDate);
    
    res.json(sessions);
  });

  // Create a class session (teacher only)
  app.post("/api/classes/:classId/sessions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    const schema = z.object({
      sessionDate: z.string(),
      title: z.string().optional(),
      notes: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid session data", errors: parsed.error.errors });
    }
    
    // Verify user is a teacher of this class
    const classLessonList = await storage.getClassLessons(classId);
    const isTeacher = classLessonList.some(l => l.teacherUserId === userId);
    
    if (!isTeacher) {
      return res.status(403).json({ message: "Only teachers can create sessions" });
    }
    
    const [session] = await db.insert(classSessions).values({
      classId,
      teacherUserId: userId,
      sessionDate: parsed.data.sessionDate,
      title: parsed.data.title,
      notes: parsed.data.notes
    }).returning();
    
    res.json(session);
  });

  // Delete a class session
  app.delete("/api/sessions/:id", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const sessionId = Number(req.params.id);
    
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher who created this session can delete it" });
    }
    
    await db.delete(classSessions).where(eq(classSessions.id, sessionId));
    res.json({ message: "Session deleted" });
  });

  // Get attendance for a session
  app.get("/api/sessions/:sessionId/attendance", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const sessionId = Number(req.params.sessionId);
    
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    // Verify user is the teacher of this session
    if (session.teacherUserId !== userId) {
      // Check if user is org owner
      const classData = await storage.getClass(session.classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }
      const membership = await storage.getOrgMembership(classData.organizationId, userId);
      if (membership?.role !== 'owner') {
        return res.status(403).json({ message: "Only the teacher or org owner can view attendance" });
      }
    }
    
    const attendance = await db.select().from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, sessionId));
    
    res.json(attendance);
  });

  // Record/update attendance for a session (batch operation)
  app.post("/api/sessions/:sessionId/attendance", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const sessionId = Number(req.params.sessionId);
    
    const schema = z.object({
      records: z.array(z.object({
        studentId: z.number(),
        status: z.enum(['present', 'absent', 'excused', 'late']),
        notes: z.string().optional()
      }))
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid attendance data", errors: parsed.error.errors });
    }
    
    const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.teacherUserId !== userId) {
      return res.status(403).json({ message: "Only the teacher can record attendance" });
    }
    
    // Upsert attendance records
    const results = [];
    for (const record of parsed.data.records) {
      // Check if record exists
      const [existing] = await db.select().from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.sessionId, sessionId),
          eq(attendanceRecords.studentId, record.studentId)
        ));
      
      if (existing) {
        // Update
        const [updated] = await db.update(attendanceRecords)
          .set({ 
            status: record.status, 
            notes: record.notes, 
            markedBy: userId,
            updatedAt: new Date()
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        // Insert
        const [inserted] = await db.insert(attendanceRecords).values({
          sessionId,
          studentId: record.studentId,
          status: record.status,
          notes: record.notes,
          markedBy: userId
        }).returning();
        results.push(inserted);
      }
    }
    
    res.json(results);
  });

  // Get attendance summary for a class (all sessions)
  app.get("/api/classes/:classId/attendance-summary", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    // Get class and verify access
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    const classLessonList = await storage.getClassLessons(classId);
    const isTeacher = classLessonList.some(l => l.teacherUserId === userId);
    const membership = await storage.getOrgMembership(classData.organizationId, userId);
    
    if (!isTeacher && membership?.role !== 'owner') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Get all sessions
    const sessions = await db.select().from(classSessions)
      .where(eq(classSessions.classId, classId))
      .orderBy(classSessions.sessionDate);
    
    // Get all attendance records for these sessions
    const sessionIds = sessions.map(s => s.id);
    let allAttendance: any[] = [];
    if (sessionIds.length > 0) {
      allAttendance = await db.select().from(attendanceRecords)
        .where(inArray(attendanceRecords.sessionId, sessionIds));
    }
    
    // Get enrolled students
    const enrollments = await storage.getClassEnrollments(classId);
    const studentIds = enrollments.map(e => e.studentId);
    const enrolledStudents = studentIds.length > 0
      ? await db.select().from(students).where(inArray(students.id, studentIds))
      : [];
    
    // Build summary per student
    const summary = enrolledStudents.map(student => {
      const studentRecords = allAttendance.filter(a => a.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        totalSessions: sessions.length,
        present: studentRecords.filter(r => r.status === 'present').length,
        absent: studentRecords.filter(r => r.status === 'absent').length,
        excused: studentRecords.filter(r => r.status === 'excused').length,
        late: studentRecords.filter(r => r.status === 'late').length,
        attendanceRate: sessions.length > 0 
          ? Math.round((studentRecords.filter(r => r.status === 'present' || r.status === 'late').length / sessions.length) * 100)
          : 0
      };
    });
    
    res.json({
      sessions,
      summary,
      totalSessions: sessions.length
    });
  });

  // Export weekly schedule PDF with QR code for submissions (teacher)
  app.get("/api/classes/:classId/schedule-pdf", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const classId = Number(req.params.classId);
    
    // Get class and verify access
    const classData = await storage.getClass(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Verify teacher access
    const classLessonList = await storage.getClassLessons(classId);
    const isTeacher = classLessonList.some(l => l.teacherUserId === userId);
    const membership = await storage.getOrgMembership(classData.organizationId, userId);
    
    if (!isTeacher && membership?.role !== 'owner') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Get organization for branding
    const org = await storage.getOrganization(classData.organizationId, userId);
    
    // Get upcoming lessons with due dates
    const lessons = classLessonList
      .filter(l => l.isActive && l.dueDate)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    
    // Get enrolled students
    const enrollments = await storage.getClassEnrollments(classId);
    const studentIds = enrollments.map(e => e.studentId);
    const enrolledStudents = studentIds.length > 0
      ? await db.select().from(students).where(inArray(students.id, studentIds))
      : [];
    
    // Create PDF
    const doc = new PDFDocument({ 
      size: 'letter',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    // Set response headers
    const filename = `${classData.name.replace(/\s+/g, '_')}_schedule_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // Header with org name if available
    if (org?.name) {
      doc.fontSize(12).font("Helvetica").fillColor("#718096").text(org.name, { align: "center" });
      doc.moveDown(0.5);
    }
    
    // Class title
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#1a365d").text(classData.name, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(14).font("Helvetica").fillColor("#4a5568").text("Weekly Schedule & Assignment Information", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#718096").text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: "center" });
    
    // Divider
    doc.moveDown(1);
    doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);
    
    // Enrolled students section
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#2d3748").text("Enrolled Students");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").fillColor("#4a5568");
    if (enrolledStudents.length > 0) {
      const studentNames = enrolledStudents.map(s => s.name).join(", ");
      doc.text(studentNames);
    } else {
      doc.text("No students enrolled");
    }
    
    doc.moveDown(1.5);
    
    // Upcoming assignments section
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#2d3748").text("Upcoming Assignments");
    doc.moveDown(0.5);
    
    if (lessons.length > 0) {
      for (const lesson of lessons.slice(0, 10)) { // Limit to 10 lessons
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a365d").text(lesson.title);
        if (lesson.dueDate) {
          const dueDate = new Date(lesson.dueDate + 'T00:00:00');
          doc.fontSize(10).font("Helvetica").fillColor("#718096")
             .text(`Due: ${dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`);
        }
        if (lesson.description) {
          doc.fontSize(10).font("Helvetica").fillColor("#4a5568").text(lesson.description);
        }
        if (lesson.instructions) {
          doc.fontSize(10).font("Helvetica-Oblique").fillColor("#718096")
             .text(`Instructions: ${lesson.instructions}`);
        }
        doc.moveDown(0.8);
      }
    } else {
      doc.fontSize(11).font("Helvetica").fillColor("#718096").text("No upcoming assignments");
    }
    
    // QR Code section for submissions
    doc.moveDown(1);
    doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1);
    
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#2d3748").text("Submit Work Photos");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").fillColor("#4a5568")
       .text("Parents: Scan the QR code below to upload photos of your child's completed work.");
    doc.moveDown(1);
    
    // Generate QR code pointing to student portal
    try {
      const requestHost = req.get('host');
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const baseUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL : process.env.REPLIT_DEPLOYMENT_URL 
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : requestHost 
            ? `${protocol}://${requestHost}`
            : 'http://localhost:5000';
      
      // QR code points to student portal login for co-op assignments
      const uploadUrl = `${baseUrl}/student-portal`;
      
      const qrDataUrl = await QRCode.toDataURL(uploadUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 150,
        color: { dark: '#1a365d', light: '#ffffff' }
      });
      
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      // Center the QR code
      const qrSize = 120;
      const pageWidth = 612;
      const qrX = (pageWidth - qrSize) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
      doc.y += qrSize + 10;
      
      doc.fontSize(9).font("Helvetica").fillColor("#718096").text(uploadUrl, { align: "center" });
    } catch (qrError) {
      console.error("Error generating QR code:", qrError);
      doc.fontSize(10).font("Helvetica").fillColor("#dc2626").text("(QR code generation failed)", { align: "center" });
    }
    
    // Footer
    doc.moveDown(2);
    doc.fontSize(9).font("Helvetica").fillColor("#a0aec0")
       .text("Students: Log in to the student portal with your PIN to view and submit assignments.", { align: "center" });
    
    doc.end();
  });

  // ============== NOTIFICATION PREFERENCES ==============

  // Get notification preferences for an organization
  app.get("/api/organizations/:orgId/notification-preferences", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    
    // Verify membership
    const membership = await storage.getOrgMembership(orgId, userId);
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ message: "Not a member of this organization" });
    }
    
    const [prefs] = await db.select().from(notificationPreferences)
      .where(and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.orgId, orgId)
      ));
    
    // Return defaults if no preferences saved
    res.json(prefs || {
      emailNewAssignment: true,
      emailDueSoon: true,
      emailMissingSubmission: false
    });
  });

  // Update notification preferences
  app.put("/api/organizations/:orgId/notification-preferences", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const orgId = Number(req.params.orgId);
    
    const schema = z.object({
      emailNewAssignment: z.boolean().optional(),
      emailDueSoon: z.boolean().optional(),
      emailMissingSubmission: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid preferences" });
    }
    
    // Verify membership
    const membership = await storage.getOrgMembership(orgId, userId);
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ message: "Not a member of this organization" });
    }
    
    // Check if prefs exist
    const [existing] = await db.select().from(notificationPreferences)
      .where(and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.orgId, orgId)
      ));
    
    if (existing) {
      const [updated] = await db.update(notificationPreferences)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(notificationPreferences).values({
        userId,
        orgId,
        ...parsed.data
      }).returning();
      return res.json(created);
    }
  });

  // Trigger due-soon notifications (can be called by cron or admin)
  app.post("/api/notifications/send-due-soon", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    // Only admin can trigger this
    const user = await storage.getUserById(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const today = new Date();
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);
      const todayStr = today.toISOString().split('T')[0];
      const futureStr = threeDaysFromNow.toISOString().split('T')[0];
      
      // Find all active class lessons due in the next 3 days
      const dueSoonLessons = await db.select().from(classLessons)
        .where(and(
          eq(classLessons.isActive, true),
          sql`${classLessons.dueDate} >= ${todayStr}`,
          sql`${classLessons.dueDate} <= ${futureStr}`
        ));
      
      let emailsSent = 0;
      
      // Group by class, then by student
      for (const lesson of dueSoonLessons) {
        const classData = await storage.getClass(lesson.classId);
        if (!classData) continue;
        
        const enrollments = await storage.getClassEnrollments(lesson.classId);
        
        for (const enrollment of enrollments) {
          // Check if student has already submitted
          const [submission] = await db.select().from(evidenceUploads)
            .where(and(
              eq(evidenceUploads.classLessonId, lesson.id),
              eq(evidenceUploads.studentId, enrollment.studentId)
            ));
          
          if (submission) continue; // Already submitted
          
          // Get student and parent info
          const [studentData] = await db.select().from(students).where(eq(students.id, enrollment.studentId));
          if (!studentData) continue;
          
          // Check notification preferences
          const [prefs] = await db.select().from(notificationPreferences)
            .where(and(
              eq(notificationPreferences.userId, studentData.userId),
              eq(notificationPreferences.orgId, classData.organizationId)
            ));
          
          if (prefs && prefs.emailDueSoon === false) continue;
          
          // Get parent email
          const [parentUser] = await db.select().from(users).where(eq(users.id, studentData.userId));
          if (!parentUser?.email) continue;
          
          const emailContent = getDueSoonEmail({
            parentName: parentUser.firstName || 'Parent',
            studentName: studentData.name,
            assignments: [{
              title: lesson.title,
              className: classData.name,
              dueDate: lesson.dueDate!
            }]
          });
          
          const sent = await sendEmail({
            to: parentUser.email,
            subject: emailContent.subject,
            html: emailContent.html
          });
          
          if (sent) emailsSent++;
        }
      }
      
      res.json({ message: `Sent ${emailsSent} due-soon notifications` });
    } catch (error) {
      console.error('Error sending due-soon notifications:', error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  // Trigger missing submission notifications (can be called by cron or admin)
  app.post("/api/notifications/send-missing-submissions", protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    // Only admin can trigger this
    const user = await storage.getUserById(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Find all active class lessons that are past due
      const pastDueLessons = await db.select().from(classLessons)
        .where(and(
          eq(classLessons.isActive, true),
          sql`${classLessons.dueDate} < ${todayStr}`
        ));
      
      let emailsSent = 0;
      
      for (const lesson of pastDueLessons) {
        const classData = await storage.getClass(lesson.classId);
        if (!classData) continue;
        
        const enrollments = await storage.getClassEnrollments(lesson.classId);
        
        for (const enrollment of enrollments) {
          // Check if student has already submitted
          const [submission] = await db.select().from(evidenceUploads)
            .where(and(
              eq(evidenceUploads.classLessonId, lesson.id),
              eq(evidenceUploads.studentId, enrollment.studentId)
            ));
          
          if (submission) continue; // Already submitted
          
          // Get student and parent info
          const [studentData] = await db.select().from(students).where(eq(students.id, enrollment.studentId));
          if (!studentData) continue;
          
          // Check notification preferences - missing submissions is opt-in
          const [prefs] = await db.select().from(notificationPreferences)
            .where(and(
              eq(notificationPreferences.userId, studentData.userId),
              eq(notificationPreferences.orgId, classData.organizationId)
            ));
          
          // Only send if explicitly opted in
          if (!prefs || prefs.emailMissingSubmission !== true) continue;
          
          // Get parent email
          const [parentUser] = await db.select().from(users).where(eq(users.id, studentData.userId));
          if (!parentUser?.email) continue;
          
          const emailContent = getMissingSubmissionEmail({
            parentName: parentUser.firstName || 'Parent',
            studentName: studentData.name,
            assignments: [{
              title: lesson.title,
              className: classData.name,
              dueDate: lesson.dueDate!
            }]
          });
          
          const sent = await sendEmail({
            to: parentUser.email,
            subject: emailContent.subject,
            html: emailContent.html
          });
          
          if (sent) emailsSent++;
        }
      }
      
      res.json({ message: `Sent ${emailsSent} missing submission notifications` });
    } catch (error) {
      console.error('Error sending missing submission notifications:', error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
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

  // ===== STRIPE SUBSCRIPTION ROUTES =====
  
  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  // Get current user's subscription status
  app.get("/api/subscription", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Count current students
      const studentList = await storage.getStudents(userId);
      const studentCount = studentList.length;
      
      // Calculate max allowed students (trial gets full access)
      const additionalStudents = parseInt(user.additionalStudentsPurchased || "0", 10);
      const plan = user.subscriptionPlan || "trial";
      const maxStudents = plan === "trial" || plan === "basic" || plan === "premium" ? (3 + additionalStudents) : 0;

      // Check trial status
      const trialEndDate = user.trialEndDate;
      const isTrialActive = plan === "trial" && trialEndDate && new Date(trialEndDate) > new Date();
      const trialDaysRemaining = trialEndDate 
        ? Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      res.json({
        plan,
        status: user.subscriptionStatus || "active",
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        studentCount,
        maxStudents,
        additionalStudents,
        trialEndDate: user.trialEndDate,
        trialDaysRemaining,
        isTrialActive,
      });
    } catch (error) {
      console.error("Error getting subscription:", error);
      res.status(500).json({ message: "Failed to get subscription" });
    }
  });

  // Get available plans/products
  app.get("/api/subscription/plans", async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      // Group prices by product
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unitAmount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error getting plans:", error);
      res.status(500).json({ message: "Failed to get plans" });
    }
  });

  // Create checkout session
  app.post("/api/subscription/checkout", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      // Validate price ID belongs to a Sunwoven base plan product (not add-ons)
      const validPrices = await db.execute(sql`
        SELECT pr.id, p.metadata->>'plan' as plan_type
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId}
          AND pr.active = true
          AND p.active = true
          AND p.metadata->>'app' = 'lessonlogger'
          AND (p.metadata->>'plan' = 'basic' OR p.metadata->>'plan' = 'premium')
      `);

      if (!validPrices.rows || validPrices.rows.length === 0) {
        return res.status(400).json({ message: "Invalid price ID. Only base subscription plans can be purchased here." });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await db.update(users)
          .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
          .where(eq(users.id, userId));
        customerId = customer.id;
      }

      // Get base URL
      const baseUrl = process.env.PUBLIC_URL || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      // Create checkout session
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/settings?subscription=success`,
        `${baseUrl}/settings?subscription=canceled`,
        userId
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Create customer portal session for managing subscription
  app.post("/api/subscription/portal", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const baseUrl = process.env.PUBLIC_URL || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

  // Feature gating endpoint - check if user has access to a feature
  app.get("/api/features/:feature", protect, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const feature = req.params.feature;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let plan = user.subscriptionPlan || "trial";
      const isAdmin = user.isAdmin === true;
      
      // Co-op members are always locked to basic plan (no premium upsells)
      const isInCoopAccount = await storage.isUserInCoopAccount(userId);
      if (isInCoopAccount && !isAdmin) {
        plan = "basic";
      }
      
      // Check if trial is active (not applicable for co-op members)
      const trialEndDate = user.trialEndDate;
      const isTrialActive = !isInCoopAccount && plan === "trial" && trialEndDate && new Date(trialEndDate) > new Date();
      
      // Feature access rules
      const basicFeatures = [
        "dashboard",
        "students",
        "schedule",
        "subjects",
        "labels",
        "reports",
        "uploads",
        "review_queue",
        "portfolio",
      ];
      
      const premiumFeatures = [
        "library",
        "curriculum",
        "ai_curriculum",
        "study_helper",
        "math_facts",
        "grammar_practice",
        "copywork_generator",
      ];

      let hasAccess = false;

      // Admins have access to everything
      if (isAdmin) {
        hasAccess = true;
      } else if (isInCoopAccount) {
        // Co-op members only get basic features (no premium upsells)
        hasAccess = basicFeatures.includes(feature);
      } else if (isTrialActive) {
        // Trial users get full premium access
        hasAccess = basicFeatures.includes(feature) || premiumFeatures.includes(feature);
      } else if (plan === "premium") {
        hasAccess = basicFeatures.includes(feature) || premiumFeatures.includes(feature);
      } else if (plan === "basic") {
        hasAccess = basicFeatures.includes(feature);
      }
      
      res.json({ 
        feature,
        hasAccess,
        plan,
        isCoopMember: isInCoopAccount,
        requiredPlan: premiumFeatures.includes(feature) ? "premium" : "basic"
      });
    } catch (error) {
      console.error("Error checking feature:", error);
      res.status(500).json({ message: "Failed to check feature access" });
    }
  });

  // ===== CMS / HOMEPAGE BUILDER ROUTES =====

  // Get all site content for landing page (public)
  app.get("/api/site/content", async (req, res) => {
    try {
      const [sections, features, pricingPlans, faqs, testimonials] = await Promise.all([
        storage.getSiteSections(),
        storage.getSiteFeatures(),
        storage.getSitePricingPlans(),
        storage.getSiteFaqs(),
        storage.getSiteTestimonials()
      ]);
      res.json({ sections, features, pricingPlans, faqs, testimonials });
    } catch (error) {
      console.error("Error getting site content:", error);
      res.status(500).json({ message: "Failed to get site content" });
    }
  });

  // Site Sections CRUD (admin only)
  app.get("/api/admin/cms/sections", protect, requireAdmin, async (req: any, res) => {
    try {
      const sections = await storage.getSiteSections();
      res.json(sections);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sections" });
    }
  });

  app.post("/api/admin/cms/sections", protect, requireAdmin, async (req: any, res) => {
    try {
      const section = await storage.createSiteSection(req.body);
      res.json(section);
    } catch (error) {
      res.status(500).json({ message: "Failed to create section" });
    }
  });

  app.patch("/api/admin/cms/sections/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      const section = await storage.updateSiteSection(parseInt(req.params.id), req.body);
      res.json(section);
    } catch (error) {
      res.status(500).json({ message: "Failed to update section" });
    }
  });

  app.delete("/api/admin/cms/sections/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.deleteSiteSection(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete section" });
    }
  });

  app.post("/api/admin/cms/sections/reorder", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.reorderSiteSections(req.body.sectionIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reorder sections" });
    }
  });

  // Site Features CRUD (admin only)
  app.get("/api/admin/cms/features", protect, requireAdmin, async (req: any, res) => {
    try {
      const features = await storage.getSiteFeatures();
      res.json(features);
    } catch (error) {
      res.status(500).json({ message: "Failed to get features" });
    }
  });

  app.post("/api/admin/cms/features", protect, requireAdmin, async (req: any, res) => {
    try {
      const feature = await storage.createSiteFeature(req.body);
      res.json(feature);
    } catch (error) {
      res.status(500).json({ message: "Failed to create feature" });
    }
  });

  app.patch("/api/admin/cms/features/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      const feature = await storage.updateSiteFeature(parseInt(req.params.id), req.body);
      res.json(feature);
    } catch (error) {
      res.status(500).json({ message: "Failed to update feature" });
    }
  });

  app.delete("/api/admin/cms/features/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.deleteSiteFeature(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete feature" });
    }
  });

  // Site Pricing Plans CRUD (admin only)
  app.get("/api/admin/cms/pricing", protect, requireAdmin, async (req: any, res) => {
    try {
      const plans = await storage.getSitePricingPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pricing plans" });
    }
  });

  app.post("/api/admin/cms/pricing", protect, requireAdmin, async (req: any, res) => {
    try {
      const plan = await storage.createSitePricingPlan(req.body);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to create pricing plan" });
    }
  });

  app.patch("/api/admin/cms/pricing/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      const plan = await storage.updateSitePricingPlan(parseInt(req.params.id), req.body);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pricing plan" });
    }
  });

  app.delete("/api/admin/cms/pricing/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.deleteSitePricingPlan(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pricing plan" });
    }
  });

  // Site FAQs CRUD (admin only)
  app.get("/api/admin/cms/faqs", protect, requireAdmin, async (req: any, res) => {
    try {
      const faqs = await storage.getSiteFaqs();
      res.json(faqs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get FAQs" });
    }
  });

  app.post("/api/admin/cms/faqs", protect, requireAdmin, async (req: any, res) => {
    try {
      const faq = await storage.createSiteFaq(req.body);
      res.json(faq);
    } catch (error) {
      res.status(500).json({ message: "Failed to create FAQ" });
    }
  });

  app.patch("/api/admin/cms/faqs/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      const faq = await storage.updateSiteFaq(parseInt(req.params.id), req.body);
      res.json(faq);
    } catch (error) {
      res.status(500).json({ message: "Failed to update FAQ" });
    }
  });

  app.delete("/api/admin/cms/faqs/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.deleteSiteFaq(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete FAQ" });
    }
  });

  // Site Testimonials CRUD (admin only)
  app.get("/api/admin/cms/testimonials", protect, requireAdmin, async (req: any, res) => {
    try {
      const testimonials = await storage.getSiteTestimonials();
      res.json(testimonials);
    } catch (error) {
      res.status(500).json({ message: "Failed to get testimonials" });
    }
  });

  app.post("/api/admin/cms/testimonials", protect, requireAdmin, async (req: any, res) => {
    try {
      const testimonial = await storage.createSiteTestimonial(req.body);
      res.json(testimonial);
    } catch (error) {
      res.status(500).json({ message: "Failed to create testimonial" });
    }
  });

  app.patch("/api/admin/cms/testimonials/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      const testimonial = await storage.updateSiteTestimonial(parseInt(req.params.id), req.body);
      res.json(testimonial);
    } catch (error) {
      res.status(500).json({ message: "Failed to update testimonial" });
    }
  });

  app.delete("/api/admin/cms/testimonials/:id", protect, requireAdmin, async (req: any, res) => {
    try {
      await storage.deleteSiteTestimonial(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete testimonial" });
    }
  });

  return httpServer;
}
