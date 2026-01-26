import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Plus, Calendar, Trash2, User, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Student, GrammarAssignment } from "@shared/schema";

type GrammarCategory = "nouns" | "verbs" | "adjectives" | "adverbs" | "pronouns" | "prepositions" | "conjunctions" | "mixed";

const CATEGORY_LABELS: Record<GrammarCategory, string> = {
  nouns: "Nouns",
  verbs: "Verbs",
  adjectives: "Adjectives",
  adverbs: "Adverbs",
  pronouns: "Pronouns",
  prepositions: "Prepositions",
  conjunctions: "Conjunctions",
  mixed: "Mixed Practice",
};

export default function GrammarPractice() {
  const { toast } = useToast();

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: assignments = [] } = useQuery<GrammarAssignment[]>({
    queryKey: ["/api/grammar-assignments"],
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState<string>("");
  const [assignCategory, setAssignCategory] = useState<GrammarCategory>("mixed");
  const [assignQuestionCount, setAssignQuestionCount] = useState(10);
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignTitle, setAssignTitle] = useState("");

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: {
      studentId: number;
      category: string;
      questionCount: number;
      dueDate: string;
      title?: string;
    }) => {
      return apiRequest("POST", "/api/grammar-assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grammar-assignments"] });
      setAssignDialogOpen(false);
      resetAssignmentForm();
      toast({
        title: "Assignment Created",
        description: "Grammar practice assignment has been assigned to the student.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create assignment.",
        variant: "destructive",
      });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/grammar-assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grammar-assignments"] });
      toast({
        title: "Assignment Deleted",
        description: "The assignment has been removed.",
      });
    },
  });

  const resetAssignmentForm = () => {
    setAssignStudentId("");
    setAssignCategory("mixed");
    setAssignQuestionCount(10);
    setAssignDueDate("");
    setAssignTitle("");
  };

  const handleCreateAssignment = () => {
    if (!assignStudentId || !assignDueDate) {
      toast({
        title: "Missing Information",
        description: "Please select a student and due date.",
        variant: "destructive",
      });
      return;
    }
    createAssignmentMutation.mutate({
      studentId: parseInt(assignStudentId),
      category: assignCategory,
      questionCount: assignQuestionCount,
      dueDate: assignDueDate,
      title: assignTitle || undefined,
    });
  };

  const getStudentName = (studentId: number) => {
    return students.find(s => s.id === studentId)?.name || "Unknown";
  };

  const pendingAssignments = assignments.filter(a => !a.completed);
  const completedAssignments = assignments.filter(a => a.completed);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Grammar Practice
            </h1>
            <p className="text-muted-foreground mt-1">
              Assign parts of speech practice to students
            </p>
          </div>
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-grammar-assignment">
                <Plus className="h-4 w-4 mr-2" />
                Assign Practice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Grammar Practice</DialogTitle>
                <DialogDescription>
                  Create a new grammar practice assignment for a student.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                    <SelectTrigger data-testid="select-assign-student">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id.toString()}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input
                    placeholder="e.g., Week 5 Grammar Review"
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    data-testid="input-assign-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={assignCategory} onValueChange={(v) => setAssignCategory(v as GrammarCategory)}>
                    <SelectTrigger data-testid="select-assign-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed Practice</SelectItem>
                      <SelectItem value="nouns">Nouns</SelectItem>
                      <SelectItem value="verbs">Verbs</SelectItem>
                      <SelectItem value="adjectives">Adjectives</SelectItem>
                      <SelectItem value="adverbs">Adverbs</SelectItem>
                      <SelectItem value="pronouns">Pronouns</SelectItem>
                      <SelectItem value="prepositions">Prepositions</SelectItem>
                      <SelectItem value="conjunctions">Conjunctions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Questions</Label>
                  <Select value={assignQuestionCount.toString()} onValueChange={(v) => setAssignQuestionCount(parseInt(v))}>
                    <SelectTrigger data-testid="select-assign-question-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 questions</SelectItem>
                      <SelectItem value="10">10 questions</SelectItem>
                      <SelectItem value="15">15 questions</SelectItem>
                      <SelectItem value="20">20 questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    data-testid="input-assign-due-date"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAssignment}
                  disabled={createAssignmentMutation.isPending}
                  data-testid="button-confirm-assignment"
                >
                  {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" data-testid="tab-pending">
              <Calendar className="h-4 w-4 mr-2" />
              Pending ({pendingAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completed ({completedAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending grammar assignments.</p>
                  <p className="text-sm mt-2">Click "Assign Practice" to create one.</p>
                </CardContent>
              </Card>
            ) : (
              pendingAssignments.map((assignment) => (
                <Card key={assignment.id} data-testid={`card-assignment-${assignment.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {getStudentName(assignment.studentId)}
                        </CardTitle>
                        <CardDescription>
                          {assignment.title || CATEGORY_LABELS[assignment.category as GrammarCategory] || assignment.category}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                        data-testid={`button-delete-assignment-${assignment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[assignment.category as GrammarCategory] || assignment.category}
                      </Badge>
                      <Badge variant="outline">
                        {assignment.questionCount} questions
                      </Badge>
                      <Badge variant="outline">
                        Due: {format(new Date(assignment.dueDate), "MMM d, yyyy")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed grammar assignments yet.</p>
                </CardContent>
              </Card>
            ) : (
              completedAssignments.map((assignment) => (
                <Card key={assignment.id} className="bg-muted/30" data-testid={`card-completed-assignment-${assignment.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          {getStudentName(assignment.studentId)}
                        </CardTitle>
                        <CardDescription>
                          {assignment.title || CATEGORY_LABELS[assignment.category as GrammarCategory] || assignment.category}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                        data-testid={`button-delete-completed-${assignment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[assignment.category as GrammarCategory] || assignment.category}
                      </Badge>
                      {assignment.score !== null && (
                        <Badge variant={assignment.score >= 80 ? "default" : "secondary"}>
                          Score: {assignment.score}%
                        </Badge>
                      )}
                      {assignment.completedAt && (
                        <Badge variant="outline">
                          Completed: {format(new Date(assignment.completedAt), "MMM d, yyyy")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
