import OpenAI from "openai";
import { z } from "zod";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ParsedChapter {
  chapterNumber: number;
  title: string;
  description?: string | null;
  pageNumber?: number | null;
}

export interface CurriculumParseResult {
  chapters: ParsedChapter[];
  curriculumName?: string;
  gradeLevel?: string;
  totalChapters: number;
}

async function extractTextWithVision(base64Image: string, mimeType: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text from this curriculum table of contents or chapter listing. Include chapter numbers, titles, and page numbers if visible. Preserve the structure and hierarchy. Return only the extracted text, maintaining the original formatting as much as possible.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || "";
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error("PDF parsing failed, trying vision:", error);
    throw new Error("PDF text extraction failed");
  }
}

const aiChapterSchema = z.object({
  chapterNumber: z.number().int().nonnegative(),
  title: z.string().min(1).max(500),
  description: z.string().max(1000).nullable().optional(),
  pageNumber: z.number().int().positive().nullable().optional(),
});

const aiResponseSchema = z.object({
  curriculumName: z.string().max(200).nullable().optional(),
  gradeLevel: z.string().max(50).nullable().optional(),
  chapters: z.array(aiChapterSchema).min(1).max(500),
});

async function parseChaptersWithAI(text: string): Promise<CurriculumParseResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a curriculum parser. Analyze the following table of contents or chapter listing and extract structured data.
Return a JSON object with this structure:
{
  "curriculumName": "name of the curriculum if identifiable",
  "gradeLevel": "grade level if mentioned",
  "chapters": [
    { "chapterNumber": 1, "title": "Chapter Title", "description": "brief description if any", "pageNumber": 1 }
  ]
}
Extract all chapters, units, or lessons. Number them sequentially if not numbered. Clean up the titles.
If you see lessons within chapters, treat each lesson as a separate entry.
Return only valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  
  try {
    const cleanedContent = content.replace(/```json\n?|\n?```/g, "").trim();
    const rawParsed = JSON.parse(cleanedContent);
    
    // Ensure chapters exist and are an array
    if (!rawParsed.chapters || !Array.isArray(rawParsed.chapters)) {
      throw new Error("AI response missing chapters array");
    }
    
    // Clean and validate each chapter
    const cleanedChapters = rawParsed.chapters.map((ch: any, index: number) => ({
      chapterNumber: typeof ch.chapterNumber === "number" ? ch.chapterNumber : index + 1,
      title: typeof ch.title === "string" && ch.title.trim() ? ch.title.trim() : `Chapter ${index + 1}`,
      description: typeof ch.description === "string" ? ch.description.trim() || null : null,
      pageNumber: typeof ch.pageNumber === "number" ? ch.pageNumber : null,
    }));
    
    const validated = aiResponseSchema.safeParse({
      curriculumName: rawParsed.curriculumName,
      gradeLevel: rawParsed.gradeLevel,
      chapters: cleanedChapters,
    });
    
    if (!validated.success) {
      console.error("AI response validation failed:", validated.error);
      throw new Error("Invalid curriculum structure from AI");
    }
    
    return {
      curriculumName: validated.data.curriculumName || undefined,
      gradeLevel: validated.data.gradeLevel || undefined,
      chapters: validated.data.chapters,
      totalChapters: validated.data.chapters.length,
    };
  } catch (error) {
    console.error("Failed to parse AI response:", content, error);
    throw new Error("Failed to parse curriculum structure");
  }
}

export async function parseCurriculumContent(
  content: string | Buffer,
  contentType: "text" | "image" | "pdf",
  mimeType?: string
): Promise<CurriculumParseResult> {
  let extractedText: string;

  switch (contentType) {
    case "text":
      extractedText = content as string;
      break;

    case "image":
      if (typeof content === "string") {
        extractedText = await extractTextWithVision(content, mimeType || "image/jpeg");
      } else {
        const base64 = content.toString("base64");
        extractedText = await extractTextWithVision(base64, mimeType || "image/jpeg");
      }
      break;

    case "pdf":
      if (typeof content === "string") {
        const buffer = Buffer.from(content, "base64");
        try {
          extractedText = await extractTextFromPdf(buffer);
        } catch {
          extractedText = await extractTextWithVision(content, "application/pdf");
        }
      } else {
        try {
          extractedText = await extractTextFromPdf(content);
        } catch {
          const base64 = content.toString("base64");
          extractedText = await extractTextWithVision(base64, "application/pdf");
        }
      }
      break;

    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error("No text could be extracted from the provided content");
  }

  return parseChaptersWithAI(extractedText);
}
