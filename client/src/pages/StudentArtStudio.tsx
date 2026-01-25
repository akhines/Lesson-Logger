import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowLeft, Palette } from "lucide-react";
import type { Student } from "@shared/schema";
import { StudentArtCanvas } from "@/components/StudentArtCanvas";
import { AvatarDisplay, parseAvatarConfig } from "@/components/AvatarBuilder";

export default function StudentArtStudio() {
  const [, setLocation] = useLocation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get("admin_token");
  
  // Parse admin token if present
  let adminStudentId: number | null = null;
  if (adminToken) {
    try {
      const decoded = JSON.parse(atob(adminToken));
      adminStudentId = decoded.studentId;
    } catch (e) {
      console.error("Invalid admin token");
    }
  }
  const isAdminViewing = !!adminToken && !!adminStudentId;

  const { data: currentStudent, isLoading: studentLoading, isError: studentError } = useQuery<Student | null>({
    queryKey: isAdminViewing ? ["/api/admin/view-student", adminStudentId] : ["/api/student-portal/me"],
    queryFn: async () => {
      if (isAdminViewing && adminStudentId) {
        const res = await fetch(`/api/admin/view-student/${adminStudentId}`, { credentials: "include" });
        if (!res.ok) return null;
        return res.json();
      }
      const res = await fetch("/api/student-portal/me");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        return null;
      }
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isAdminViewing && !studentLoading && (studentError || currentStudent === null)) {
      setLocation("/student-login");
    }
  }, [studentLoading, studentError, currentStudent, setLocation, isAdminViewing]);

  if (studentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <GraduationCap className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentStudent && !isAdminViewing) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {isAdminViewing && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center">
          <span className="text-sm font-medium">Admin View Mode</span>
        </div>
      )}
      
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(isAdminViewing ? `/student-portal?admin_token=${adminToken}` : "/student-portal")}
              data-testid="button-back-to-portal"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {currentStudent && (
              <AvatarDisplay 
                config={parseAvatarConfig(currentStudent.avatar)} 
                size={40} 
                className="ring-2 ring-primary/20"
              />
            )}
            <div>
              <h1 className="font-display font-bold text-xl flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Art Studio
              </h1>
              {currentStudent && (
                <p className="text-sm text-muted-foreground">{currentStudent.name}'s Artwork</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {currentStudent && <StudentArtCanvas studentId={currentStudent.id} />}
      </main>
    </div>
  );
}
