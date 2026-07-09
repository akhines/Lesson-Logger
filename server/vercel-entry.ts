// Source for the Vercel serverless handler. This is bundled by script/build.ts
// into dist/vercel.cjs (a single self-contained CJS file) so Vercel doesn't
// have to resolve the server's extensionless ESM relative imports per-file.
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

const app = express();

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
function ensureReady() {
  if (!readyPromise) {
    readyPromise = registerRoutes(createServer(app), app);
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
    });
  }
}
