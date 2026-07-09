import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.url": "importMetaUrl",
    },
    inject: [],
    banner: {
      js: `const importMetaUrl = require('url').pathToFileURL(__filename).toString();`,
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Bundle the Vercel serverless handler into a single self-contained CJS file
  // so Vercel doesn't have to resolve the server's extensionless ESM imports.
  console.log("building vercel handler...");
  await esbuild({
    entryPoints: ["server/vercel-entry.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "api/_bundle.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.url": "importMetaUrl",
    },
    banner: {
      js: `const importMetaUrl = require('url').pathToFileURL(__filename).toString();`,
    },
    // Self-contained: inline all deps so Vercel doesn't need to trace/ship any
    // node_modules for the function. Only truly-optional native deps stay
    // external (the libraries load them lazily and tolerate their absence).
    minify: false,
    external: ["pg-native", "cpu-features", "bufferutil", "utf-8-validate"],
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
