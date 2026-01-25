import { AppLayout } from "@/components/AppLayout";
import { useSubjects, useDeleteSubject } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { CreateSubjectDialog } from "@/components/CreateSubjectDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical, Trash2, Pencil, BookOpen, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import type { Subject } from "@shared/schema";
import { SUBJECT_CATEGORY_COLORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const SUBJECT_CATEGORY_LABELS: Record<string, string> = {
  language_arts: "Language Arts",
  math: "Math",
  science: "Science",
  history: "History",
  art: "Art",
  music: "Music",
  physical_education: "PE",
  foreign_language: "Foreign Language",
  other: "Other",
};

export default function Subjects() {
  const { data: subjects, isLoading } = useSubjects();
  const { data: students } = useStudents();
  const deleteMutation = useDeleteSubject();
  const { toast } = useToast();
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getStudentName = (studentId: number | null) => {
    if (!studentId || !students) return null;
    const student = students.find((s) => s.id === studentId);
    return student?.name || null;
  };

  const getStudent = (studentId: number | null) => {
    if (!studentId || !students) return null;
    return students.find((s) => s.id === studentId) || null;
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this subject? This will delete all associated lessons.")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Subject deleted" });
      } catch (error) {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSubject(undefined);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Subjects</h1>
          <p className="text-muted-foreground">Manage your curriculum and courses.</p>
        </div>
        <CreateSubjectDialog 
          subject={editingSubject} 
          open={dialogOpen} 
          onOpenChange={setDialogOpen}
          trigger={
            <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20">
              <span className="text-lg">+</span> Add Subject
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((subject) => (
            <Card key={subject.id} className="group hover:shadow-lg transition-all duration-300 border-border/60 overflow-hidden" data-testid={`card-subject-${subject.id}`}>
              <div 
                className="h-1"
                style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
              />
              <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-subject-name-${subject.id}`}>{subject.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(subject)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(subject.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {subject.description || "No description provided for this subject."}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge 
                    variant="outline" 
                    className="text-xs text-white"
                    style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'], borderColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'] }}
                  >
                    {SUBJECT_CATEGORY_LABELS[subject.category || 'other']}
                  </Badge>
                  {subject.gradeLevel && (
                    <Badge variant="secondary" className="text-xs">
                      Grade {subject.gradeLevel}
                    </Badge>
                  )}
                  {subject.curriculumSource && (
                    <Badge variant="outline" className="text-xs">
                      {subject.curriculumSource}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex items-center gap-2">
                {(() => {
                  const student = getStudent(subject.studentId);
                  return student ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: student.color || '#6B7280' }}
                      />
                      {student.name}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md">
                      No student assigned
                    </div>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
          
          {subjects?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-bold">No subjects yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">Create your first subject to start scheduling lessons and assignments.</p>
              <Button onClick={handleCreate}>Create Subject</Button>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
