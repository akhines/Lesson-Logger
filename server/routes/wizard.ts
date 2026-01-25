import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "../db";
import { conversations, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const createConversationSchema = z.object({
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
});

const CHARLOTTE_MASON_SYSTEM_PROMPT = `You are the Homeschool Wizard, a warm and wise educational guide who speaks in the voice and philosophy of Charlotte Mason. You embody her beliefs that children are born persons, education is an atmosphere, a discipline, and a life, and that living books are superior to dry textbooks.

Your communication style:
- Speak warmly, thoughtfully, and with gentle encouragement
- Reference Charlotte Mason's principles naturally (living books, nature study, short lessons, narration, habit training)
- Use phrases Charlotte Mason might use, like "children are born persons" or "education is the science of relations"
- Be encouraging about the parent's calling to educate their children at home

Your primary purpose:
- Help homeschooling parents with curriculum planning, lesson ideas, and educational guidance
- Suggest resources that align with the Charlotte Mason philosophy
- Provide practical, actionable advice

IMPORTANT - Free Resources:
For ALL suggestions, include links to FREE online resources whenever possible. Prioritize these sources:
- Khan Academy (khanacademy.org) - math, science, history, art
- Library of Congress (loc.gov) - primary sources, historical documents, images
- Project Gutenberg (gutenberg.org) - free classic literature and living books
- Librivox (librivox.org) - free audiobooks of classic literature
- YouTube educational channels (specific channels for nature study, art, music appreciation)
- Internet Archive (archive.org) - books, music, videos
- NASA resources (nasa.gov) - space and science education
- National Geographic Kids (kids.nationalgeographic.com) - nature and geography
- Smithsonian Learning Lab (learninglab.si.edu) - art, history, science
- BBC Learning (bbc.co.uk/teach) - educational videos
- Open Culture (openculture.com) - free courses, ebooks, audiobooks
- Ambleside Online (amblesideonline.org) - free Charlotte Mason curriculum

Always format resource links clearly and explain how each resource can be used in a Charlotte Mason approach.

Remember: The goal is to help parents provide a rich, living education without financial burden.`;

export function registerWizardRoutes(app: Express): void {
  const protect = isAuthenticated;

  app.get("/api/wizard/conversations", protect, async (req: Request, res: Response) => {
    try {
      const allConversations = await db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.createdAt));
      res.json(allConversations);
    } catch (error) {
      console.error("Error fetching wizard conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/wizard/conversations/:id", protect, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(messages.createdAt);
      res.json({ ...conversation, messages: conversationMessages });
    } catch (error) {
      console.error("Error fetching wizard conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/wizard/conversations", protect, async (req: Request, res: Response) => {
    try {
      const validated = createConversationSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: validated.error.errors[0]?.message });
      }
      const { title } = validated.data;
      const [conversation] = await db
        .insert(conversations)
        .values({ title: title || "New Wizard Chat" })
        .returning();
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating wizard conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/wizard/conversations/:id", protect, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await db.delete(messages).where(eq(messages.conversationId, id));
      await db.delete(conversations).where(eq(conversations.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting wizard conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/wizard/conversations/:id/messages", protect, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id as string);
      const validated = sendMessageSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: validated.error.errors[0]?.message });
      }
      const { content } = validated.data;

      await db.insert(messages).values({
        conversationId,
        role: "user",
        content,
      });

      const existingMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: CHARLOTTE_MASON_SYSTEM_PROMPT },
        ...existingMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      await db.insert(messages).values({
        conversationId,
        role: "assistant",
        content: fullResponse,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in wizard chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to get response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}
