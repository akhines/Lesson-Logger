// Vercel serverless entry — wraps the Express app so the whole API runs as one
// function. The static client is served by Vercel from dist/public (see
// vercel.json); this function only handles /api/* requests.
//
// It deliberately does NOT import server/index.ts (which calls app.listen()).
// Routes are registered once and reused across warm invocations.
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

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
    // registerRoutes takes an http.Server (used for websockets, which we don't
    // have) plus the app; we never listen on it.
    readyPromise = registerRoutes(createServer(app), app);
  }
  return readyPromise;
}

export default async function handler(req: Request, res: Response) {
  await ensureReady();
  return (app as unknown as (req: Request, res: Response) => void)(req, res);
}
