// Vercel serverless entry. The Express app is pre-bundled by script/build.ts
// into ap./_app.cjs (a single self-contained CJS file). We load it with
// createRequire (robust CJS interop from an ESM module) inside a try/catch so
// any load-time failure surfaces as JSON instead of an opaque 500.
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let handler: ((req: any, res: any) => any) | null = null;

export default function (req: any, res: any) {
  try {
    if (!handler) {
      const mod = require("./_app.cjs");
      handler = (mod.default || mod) as (req: any, res: any) => any;
    }
    return handler(req, res);
  } catch (err: any) {
    res.status(500).json({
      error: "load_failed",
      message: err?.message || String(err),
      stack: (err?.stack || "").split("\n").slice(0, 10),
    });
  }
}
