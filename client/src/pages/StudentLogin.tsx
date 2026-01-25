import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft } from "lucide-react";
import type { Student } from "@shared/schema";

export default function StudentLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [pin, setPin] = useState("");

  const { data: students, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/students/public"],
    queryFn: async () => {
      const res = await fetch("/api/students/public");
      if (!res.ok) {
        return [];
      }
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { studentId: number; pin: string }) => {
      return apiRequest("POST", "/api/student-auth/login", data);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.success) {
        toast({ title: `Welcome, ${data.student?.name || 'Student'}!` });
        setLocation("/student-portal");
      } else {
        toast({ title: "Invalid PIN", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Login failed. Please check your PIN.", variant: "destructive" });
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !pin) {
      toast({ title: "Please select a student and enter your PIN", variant: "destructive" });
      return;
    }
    await loginMutation.mutateAsync({ studentId: parseInt(selectedStudent), pin });
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
            Enter your PIN to view your schedule and assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Select Your Name</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger id="student" data-testid="select-student-login">
                  <SelectValue placeholder="Choose your name" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : students && students.length > 0 ? (
                    students.filter(s => s.pin).map(student => (
                      <SelectItem key={student.id} value={student.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: student.color || '#6B7280' }}
                          />
                          {student.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No students with PIN set</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pin">Your PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                data-testid="input-student-pin-login"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loginMutation.isPending}
              data-testid="button-student-login"
            >
              {loginMutation.isPending ? "Logging in..." : "Enter Portal"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Parent Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
