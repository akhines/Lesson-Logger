import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import sunwovenLogo from "@assets/sunwoven_logo_only_1769366536907.png";

// The server returns errors as `${status}: ${jsonBody}` — pull out the message.
function readError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/\{.*\}$/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed?.message) return parsed.message;
    } catch {
      /* fall through */
    }
  }
  return raw.replace(/^\d+:\s*/, "") || "Something went wrong. Please try again.";
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pending = isLoggingIn || isRegistering;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, firstName, lastName });
      }
      setLocation("/");
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <img src={sunwovenLogo} alt="Sunwoven Homeschool" className="h-16 w-auto object-contain mb-3" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Sunwoven Homeschool</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to manage your homeschool</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Welcome back" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your email and password to continue."
                : "Set up an account to start planning lessons."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name" data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name" data-testid="input-last-name" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                  data-testid="input-email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "register" ? "At least 8 characters" : undefined}
                  data-testid="input-password" />
              </div>

              {error && (
                <p className="text-sm text-destructive" data-testid="text-auth-error">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={pending} data-testid="button-submit-auth">
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button type="button" className="text-primary font-medium hover:underline"
                    onClick={() => { setMode("register"); setError(null); }} data-testid="button-switch-register">
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="text-primary font-medium hover:underline"
                    onClick={() => { setMode("login"); setError(null); }} data-testid="button-switch-login">
                    Sign in
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/")} data-testid="button-back-home">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
