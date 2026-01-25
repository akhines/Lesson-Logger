import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
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

  // Subjects
  app.get(api.subjects.list.path, protect, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const subjects = await storage.getSubjects(userId);
    res.json(subjects);
  });

  app.get(api.subjects.get.path, protect, async (req, res) => {
    const subject = await storage.getSubject(Number(req.params.id));
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
  });

  app.post(api.subjects.create.path, protect, async (req: any, res) => {
    try {
      const input = api.subjects.create.input.parse({ ...req.body, userId: req.user.claims.sub });
      const subject = await storage.createSubject(input);
      
      if (input.curriculumSource) {
        await storage.generateLessonsFromCurriculum(subject.id, input.curriculumSource);
      }
      
      res.status(201).json(subject);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.subjects.update.path, protect, async (req, res) => {
    try {
      const input = api.subjects.update.input.parse(req.body);
      const subject = await storage.updateSubject(Number(req.params.id), input);
      res.json(subject);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Subject not found" });
    }
  });

  app.delete(api.subjects.delete.path, protect, async (req, res) => {
    await storage.deleteSubject(Number(req.params.id));
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
    const { lessonId } = req.query;
    const assignments = await storage.getAssignments(lessonId ? Number(lessonId) : undefined);
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
