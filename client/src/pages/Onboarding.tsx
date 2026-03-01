import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, BookOpen, CheckCircle2, ArrowRight, ArrowLeft, Plus, X, Sparkles, GraduationCap
} from "lucide-react";
import type { Student } from "@shared/schema";

const GRADE_LEVELS = ["Pre-K", "K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

const SUBJECT_TEMPLATES: Record<string, string[]> = {
  Elementary: ["Reading", "Writing", "Math", "Science", "Social Studies", "Art", "Physical Education"],
  Middle: ["Language Arts", "Math", "Science", "History", "Geography", "Art", "Physical Education", "Foreign Language"],
  High: ["English", "Algebra", "Biology", "World History", "Government", "Art", "Physical Education", "Foreign Language", "Computer Science"],
};

const STUDENT_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

interface NewStudent {
  name: string;
  gradeLevel: string;
  color: string;
}

export default function Onboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);

  const [newStudents, setNewStudents] = useState<NewStudent[]>([
    { name: "", gradeLevel: "", color: STUDENT_COLORS[0] },
  ]);
  const [createdStudentIds, setCreatedStudentIds] = useState<number[]>([]);

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");

  const { data: existingStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: onboardingStatus } = useQuery<{ onboardingComplete: boolean }>({
    queryKey: ["/api/onboarding/status"],
  });

  useEffect(() => {
    if (onboardingStatus?.onboardingComplete) {
      setLocation("/");
    }
  }, [onboardingStatus, setLocation]);

  const createStudentMutation = useMutation({
    mutationFn: async (student: NewStudent) => {
      const res = await apiRequest("POST", "/api/students", {
        name: student.name,
        gradeLevel: student.gradeLevel || undefined,
        color: student.color,
      });
      return res.json();
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/subjects", {
        name,
        category: "other",
        scheduledDays: [1, 2, 3, 4, 5],
        totalLessons: 180,
      });
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/complete", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/skip", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      setLocation("/");
    },
  });

  function addStudentRow() {
    const nextColor = STUDENT_COLORS[newStudents.length % STUDENT_COLORS.length];
    setNewStudents([...newStudents, { name: "", gradeLevel: "", color: nextColor }]);
  }

  function removeStudentRow(index: number) {
    if (newStudents.length <= 1) return;
    setNewStudents(newStudents.filter((_, i) => i !== index));
  }

  function updateStudent(index: number, field: keyof NewStudent, value: string) {
    const updated = [...newStudents];
    updated[index] = { ...updated[index], [field]: value };
    setNewStudents(updated);
  }

  function applyTemplate(template: string) {
    setSelectedTemplate(template);
    setSubjects([...SUBJECT_TEMPLATES[template]]);
  }

  function addCustomSubject() {
    const trimmed = customSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setCustomSubject("");
    }
  }

  function removeSubject(name: string) {
    setSubjects(subjects.filter(s => s !== name));
  }

  async function handleStep1Next() {
    const validStudents = newStudents.filter(s => s.name.trim());
    if (validStudents.length === 0) {
      toast({ title: "Add at least one student", description: "Enter a student name to continue.", variant: "destructive" });
      return;
    }

    try {
      const ids: number[] = [];
      for (const student of validStudents) {
        const created = await createStudentMutation.mutateAsync(student);
        ids.push(created.id);
      }
      setCreatedStudentIds(ids);
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create student(s).", variant: "destructive" });
    }
  }

  async function handleStep2Next() {
    if (subjects.length > 0) {
      try {
        for (const name of subjects) {
          await createSubjectMutation.mutateAsync(name);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      } catch (err: any) {
        toast({ title: "Error", description: err.message || "Failed to create subjects.", variant: "destructive" });
      }
    }
    await completeMutation.mutateAsync();
    setStep(3);
  }

  async function handleFinish(action: "log" | "dashboard") {
    if (action === "log") {
      setLocation("/?openQuickLog=true");
    } else {
      setLocation("/");
    }
  }

  const hasValidStudent = newStudents.some(s => s.name.trim());
  const isCreating = createStudentMutation.isPending;
  const isCreatingSubjects = createSubjectMutation.isPending || completeMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-display" data-testid="text-onboarding-title">Welcome!</h1>
          </div>
          <p className="text-muted-foreground">Let's get you set up in just a couple of steps.</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8" data-testid="onboarding-progress">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                s < step ? "bg-primary text-primary-foreground" :
                s === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-8 ${s < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card data-testid="card-step-1">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Add Your Students</h2>
              </div>
              <p className="text-sm text-muted-foreground">Who will you be tracking? You can always add more later.</p>

              <div className="space-y-3">
                {newStudents.map((student, i) => (
                  <div key={i} className="flex items-end gap-2" data-testid={`student-row-${i}`}>
                    <div
                      className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-lg cursor-pointer"
                      style={{ backgroundColor: student.color }}
                      onClick={() => {
                        const nextIdx = (STUDENT_COLORS.indexOf(student.color) + 1) % STUDENT_COLORS.length;
                        updateStudent(i, "color", STUDENT_COLORS[nextIdx]);
                      }}
                      title="Click to change color"
                    >
                      {student.name ? student.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        placeholder="Student name"
                        value={student.name}
                        onChange={e => updateStudent(i, "name", e.target.value)}
                        data-testid={`input-student-name-${i}`}
                      />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Grade</Label>
                      <Select value={student.gradeLevel} onValueChange={v => updateStudent(i, "gradeLevel", v)}>
                        <SelectTrigger data-testid={`select-grade-${i}`}><SelectValue placeholder="Grade" /></SelectTrigger>
                        <SelectContent>
                          {GRADE_LEVELS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {newStudents.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => removeStudentRow(i)}
                        data-testid={`button-remove-student-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addStudentRow} data-testid="button-add-another-student">
                <Plus className="h-4 w-4 mr-1" />
                Add another student
              </Button>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => skipMutation.mutate()} data-testid="button-skip-onboarding">
                  Skip for now
                </Button>
                <Button onClick={handleStep1Next} disabled={!hasValidStudent || isCreating} data-testid="button-step1-next">
                  {isCreating ? "Creating..." : "Next"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card data-testid="card-step-2">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Pick Your Subjects</h2>
              </div>
              <p className="text-sm text-muted-foreground">Start with a template or add your own. You can customize later.</p>

              <div className="flex flex-wrap gap-2">
                {Object.keys(SUBJECT_TEMPLATES).map(template => (
                  <Button
                    key={template}
                    variant={selectedTemplate === template ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyTemplate(template)}
                    data-testid={`button-template-${template.toLowerCase()}`}
                  >
                    {template}
                  </Button>
                ))}
              </div>

              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5" data-testid="subject-list">
                  {subjects.map(subject => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="text-sm py-1 px-2 gap-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => removeSubject(subject)}
                      data-testid={`badge-subject-${subject}`}
                    >
                      {subject}
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Add a custom subject"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomSubject())}
                  data-testid="input-custom-subject"
                />
                <Button variant="outline" size="icon" onClick={addCustomSubject} disabled={!customSubject.trim()} data-testid="button-add-subject">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="ghost" onClick={() => setStep(1)} data-testid="button-step2-back">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button onClick={handleStep2Next} disabled={isCreatingSubjects} data-testid="button-step2-next">
                  {isCreatingSubjects ? "Setting up..." : subjects.length > 0 ? "Next" : "Skip subjects"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card data-testid="card-step-3">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold font-display">You're all set!</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your family is ready. Start by logging your first lesson — it only takes seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button size="lg" className="gap-2" onClick={() => handleFinish("log")} data-testid="button-log-today">
                  <Plus className="h-5 w-5" />
                  Log Today
                </Button>
                <Button variant="outline" size="lg" onClick={() => handleFinish("dashboard")} data-testid="button-go-dashboard">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
