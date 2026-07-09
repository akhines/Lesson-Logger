// Vercel serverless entry. The Express app is pre-bundled by script/build.ts
// into api/_bundle.cjs (a single self-contained CJS file) so Vercel doesn't
// have to resolve the server's extensionless ESM imports per-file. Keeping the
// bundle inside api/ (as an underscore-prefixed support file) ensures Vercel's
// file tracer includes it and its dependencies with the function.
// @ts-ignore - generated at build time
import handler from "./_bundle.cjs";

export default handler;
