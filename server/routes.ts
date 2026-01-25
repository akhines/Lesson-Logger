import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { subjects, lessons, students } from "@shared/schema";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Setup Object Storage
  registerObjectStorageRoutes(app);

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

  // Assignments
  app.get(api.assignments.list.path, protect, async (req, res) => {
    const { lessonId, studentId, subjectId, startDate, endDate } = req.query;
    const assignments = await storage.getAssignments({
      lessonId: lessonId ? Number(lessonId) : undefined,
      studentId: studentId ? Number(studentId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json(assignments);
  });

  app.get(api.assignments.get.path, protect, async (req, res) => {
    const assignment = await storage.getAssignment(Number(req.params.id));
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json(assignment);
  });

  app.post(api.assignments.create.path, protect, async (req, res) => {
    try {
      const input = api.assignments.create.input.parse(req.body);
      const assignment = await storage.createAssignment(input);
      res.status(201).json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.assignments.update.path, protect, async (req, res) => {
    try {
      const input = api.assignments.update.input.parse(req.body);
      const assignment = await storage.updateAssignment(Number(req.params.id), input);
      res.json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Assignment not found" });
    }
  });

  app.delete(api.assignments.delete.path, protect, async (req, res) => {
    await storage.deleteAssignment(Number(req.params.id));
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
    
    if (subjectIds.length === 0) {
      return res.json([]);
    }
    
    // Get lessons for these subjects
    const studentLessons = await db.select().from(lessons).where(inArray(lessons.subjectId, subjectIds));
    res.json(studentLessons);
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
    
    const student = await storage.getStudent(studentId);
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

  // Seed Data
  if (process.env.NODE_ENV !== "production") {
    const existingSubjects = await storage.getSubjects("seed-user"); // Just check if any exist generally, or by specific seed user if we had one. 
    // Since we need a user ID for subjects, we can't easily seed without a user.
    // But we can check if table is empty. 
    // However, `storage.getSubjects` requires userId.
    // Let's just skip auto-seeding for now as it requires a valid user ID (from Auth).
    // Or we could create a demo user if needed, but Replit Auth manages users.
    // We can leave this empty or add a specific seed endpoint that takes a user ID.
  }

  return httpServer;
}
