import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, User, Lock } from "lucide-react";
import { StudentAvatar } from "@/components/AvatarSelector";

export default function StudentLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [foundStudent, setFoundStudent] = useState<{ id: number; name: string; avatar: string | null } | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch(`/api/student-auth/lookup?username=${encodeURIComponent(username)}`);
      if (!res.ok) {
        throw new Error("Student not found");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.student) {
        setFoundStudent(data.student);
      } else {
        toast({ title: "No student found with that username", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Student not found. Check your username.", variant: "destructive" });
      setFoundStudent(null);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { studentId: number; pin: string }) => {
      return apiRequest("POST", "/api/student-auth/login", data);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.success) {
        toast({ title: `Welcome back, ${data.student?.name || 'Student'}!` });
        setLocation("/student-portal");
      } else {
        toast({ title: "Incorrect PIN", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Login failed. Please check your PIN.", variant: "destructive" });
    },
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({ title: "Please enter your username", variant: "destructive" });
      return;
    }
    lookupMutation.mutate(username.trim().toLowerCase());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundStudent || !pin) {
      toast({ title: "Please enter your PIN", variant: "destructive" });
      return;
    }
    await loginMutation.mutateAsync({ studentId: foundStudent.id, pin });
  };

  const handleBack = () => {
    setFoundStudent(null);
    setPin("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Student Portal</CardTitle>
          <CardDescription>
            {foundStudent 
              ? `Hi ${foundStudent.name}! Enter your PIN to continue.`
              : "Enter your username to get started"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!foundStudent ? (
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Your Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="pl-10"
                    autoComplete="username"
                    data-testid="input-student-username-login"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask your parent if you don't know your username
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={lookupMutation.isPending || !username.trim()}
                data-testid="button-find-student"
              >
                {lookupMutation.isPending ? "Looking up..." : "Continue"}
              </Button>

              <div className="text-center">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setLocation("/")}
                  className="text-muted-foreground"
                  data-testid="link-parent-login"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Parent Login
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex flex-col items-center gap-3 mb-6">
                <StudentAvatar avatar={foundStudent.avatar} size="xl" />
                <div className="text-center">
                  <p className="font-semibold text-lg">{foundStudent.name}</p>
                  <p className="text-sm text-muted-foreground">@{username}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">Your Secret PIN</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pin"
                    type="password"
                    placeholder="Enter your PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="pl-10 text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoComplete="current-password"
                    autoFocus
                    data-testid="input-student-pin-login"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loginMutation.isPending || !pin}
                data-testid="button-student-login"
              >
                {loginMutation.isPending ? "Logging in..." : "Log In"}
              </Button>

              <div className="text-center">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleBack}
                  className="text-muted-foreground"
                  data-testid="button-back-to-username"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Not you? Go back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
