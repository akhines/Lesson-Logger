// Vercel serverless entry — wraps the Express app so the whole API runs as one
// function. The static client is served by Vercel from dist/public (see
// vercel.json); all /api/* requests are rewritten to this function.
//
// The heavy server imports are done lazily inside a try/catch so that any
// startup error surfaces as a JSON response instead of an opaque
// FUNCTION_INVOCATION_FAILED.
import express, { type Request, type Response } from "express";

export const app = express();

app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

let readyPromise: Promise<unknown> | null = null;
export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const { registerRoutes } = await import("../server/routes");
      const { createServer } = await import("http");
      await registerRoutes(createServer(app), app);
    })();
  }
  return readyPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    await ensureReady();
    return (app as unknown as (req: Request, res: Response) => void)(req, res);
  } catch (err: any) {
    readyPromise = null; // allow a retry on the next invocation
    res.status(500).json({
      error: "startup_failed",
      message: err?.message || String(err),
      stack: (err?.stack || "").split("\n").slice(0, 6),
    });
  }
}
