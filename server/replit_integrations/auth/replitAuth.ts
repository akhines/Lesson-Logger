// Local email/password authentication.
//
// NOTE: this file keeps its historical name/exports (setupAuth, isAuthenticated,
// getSession) so the rest of the server keeps importing from the same place.
// It no longer uses Replit Auth — it is a self-contained passport-local strategy
// with scrypt password hashing and a Postgres-backed session store, suitable for
// running anywhere (Fly.io, a container, localhost).
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { authStorage } from "./storage";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(stored: string, supplied: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return hashedBuf.length === suppliedBuf.length && timingSafeEqual(hashedBuf, suppliedBuf);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// The rest of the app reads the current user id from `req.user.claims.sub`
// (a holdover from the OIDC days). We keep that shape so no route code changes.
function toSessionUser(user: any) {
  return { ...user, claims: { sub: user.id } };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.trim().toLowerCase());
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const ok = await verifyPassword(user.passwordHash, password);
          if (!ok) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, toSessionUser(user));
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user ? toSessionUser(user) : null);
    } catch (err) {
      cb(err as Error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return res.status(500).json({ message: "Internal server error" });
      if (!user) return res.status(401).json({ message: info?.message || "Invalid email or password" });
      req.logIn(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ message: "Failed to create session" });
        const { passwordHash, ...safe } = user;
        return res.json(safe);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res) => {
    try {
      const email = (req.body?.email || "").trim().toLowerCase();
      const password = req.body?.password || "";
      const { firstName, lastName } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password);
      const user = await authStorage.createUser({
        email,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });

      req.logIn(toSessionUser(user), (loginErr) => {
        if (loginErr) return res.status(500).json({ message: "Account created but failed to log in" });
        const { passwordHash: _ph, ...safe } = user;
        return res.json(safe);
      });
    } catch (err) {
      console.error("Registration error:", err);
      return res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => res.json({ ok: true }));
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
