// Vercel serverless entry. The actual Express app is pre-bundled by
// script/build.ts into dist/vercel.cjs (a single self-contained file) so that
// Vercel doesn't have to resolve the server's extensionless ESM imports
// per-file. This thin wrapper just re-exports that bundled handler.
// @ts-ignore - generated at build time
import handler from "../dist/vercel.cjs";

export default handler;
