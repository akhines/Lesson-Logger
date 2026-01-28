import { AppLayout } from "@/components/AppLayout";
import { useSubjects, useDeleteSubject, type SubjectWithStudents } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { CreateSubjectDialog } from "@/components/CreateSubjectDialog";
import { CurriculumUploadDialog } from "@/components/CurriculumUploadDialog";
import { CurriculumBrowserDialog } from "@/components/CurriculumBrowserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical, Trash2, Pencil, BookOpen, Users, Feather, Sparkles, Library, Filter, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { SUBJECT_CATEGORY_COLORS, FORM_LABELS } from "@shared/schema";
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
  const [editingSubject, setEditingSubject] = useState<SubjectWithStudents | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preselectedCurriculum, setPreselectedCurriculum] = useState<{ name: string; category: string; grades: string } | null>(null);
  
  // Filter and sort state
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  
  // Filter and sort subjects
  const filteredAndSortedSubjects = useMemo(() => {
    if (!subjects) return [];
    
    let result = [...subjects];
    
    // Filter by student
    if (studentFilter !== "all") {
      const studentId = parseInt(studentFilter);
      result = result.filter(subject => {
        // Check in students array (multi-student subjects)
        if (subject.students && subject.students.length > 0) {
          return subject.students.some(s => s.id === studentId);
        }
        // Fall back to legacy studentId
        return subject.studentId === studentId;
      });
    }
    
    // Filter by category
    if (categoryFilter !== "all") {
      result = result.filter(subject => subject.category === categoryFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "category":
          return (a.category || "other").localeCompare(b.category || "other");
        case "student":
          const aStudent = a.students?.[0]?.name || "";
          const bStudent = b.students?.[0]?.name || "";
          return aStudent.localeCompare(bStudent);
        default:
          return 0;
      }
    });
    
    return result;
  }, [subjects, studentFilter, categoryFilter, sortBy]);
  
  // Get unique categories from subjects
  const availableCategories = useMemo(() => {
    if (!subjects) return [];
    const categories = new Set<string>();
    subjects.forEach(s => categories.add(s.category || "other"));
    return Array.from(categories).sort();
  }, [subjects]);

  const handleCurriculumSelect = (curriculum: { name: string; category: string; grades: string }) => {
    setPreselectedCurriculum(curriculum);
    setEditingSubject(undefined);
    setDialogOpen(true);
  };

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

  const handleEdit = (subject: SubjectWithStudents) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setPreselectedCurriculum(null);
    setEditingSubject(undefined);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Subjects</h1>
          <p className="text-muted-foreground">Manage your curriculum and courses.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <CurriculumBrowserDialog onSelectCurriculum={handleCurriculumSelect} />
          <CreateSubjectDialog 
            subject={editingSubject} 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setPreselectedCurriculum(null);
            }}
            preselectedCurriculum={preselectedCurriculum}
            trigger={
              <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20">
                <span className="text-lg">+</span> Add Subject
              </Button>
            }
          />
        </div>
      </div>
      
      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-student">
            <SelectValue placeholder="All Students" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            {students?.map(student => (
              <SelectItem key={student.id} value={String(student.id)}>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2.5 w-2.5 rounded-full" 
                    style={{ backgroundColor: student.color || '#6B7280' }}
                  />
                  {student.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {availableCategories.map(category => (
              <SelectItem key={category} value={category}>
                <div className="flex items-center gap-2">
                  <div 
                    className="h-2.5 w-2.5 rounded-full" 
                    style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[category] || SUBJECT_CATEGORY_COLORS.other }}
                  />
                  {SUBJECT_CATEGORY_LABELS[category] || category}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {(studentFilter !== "all" || categoryFilter !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setStudentFilter("all");
              setCategoryFilter("all");
            }}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        )}
      </div>
      
      {/* Results count */}
      {!isLoading && subjects && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredAndSortedSubjects.length} of {subjects.length} subjects
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedSubjects.map((subject) => (
            <Link href={`/subjects/${subject.id}`} key={subject.id}>
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/60 overflow-hidden cursor-pointer hover-elevate" data-testid={`card-subject-${subject.id}`}>
                <div 
                  className="h-1"
                  style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
                />
                <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[subject.category || 'other'] || SUBJECT_CATEGORY_COLORS.other }}
                    >
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg" data-testid={`text-subject-name-${subject.id}`}>{subject.name}</CardTitle>
                  </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(subject); }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <CurriculumUploadDialog 
                      subjectId={subject.id} 
                      subjectName={subject.name}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid={`button-ai-import-${subject.id}`}>
                          <Sparkles className="mr-2 h-4 w-4" /> AI Import
                        </DropdownMenuItem>
                      }
                    />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); handleDelete(subject.id); }}
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
                  {subject.formLevel && (
                    <Link href={`/assignments?form=${subject.formLevel}`}>
                      <Badge 
                        variant="outline" 
                        className="text-xs cursor-pointer hover-elevate bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700"
                        data-testid={`link-form-${subject.formLevel}-${subject.id}`}
                      >
                        <Feather className="h-3 w-3 mr-1" />
                        {FORM_LABELS[subject.formLevel as keyof typeof FORM_LABELS]}
                      </Badge>
                    </Link>
                  )}
                </div>
                
                <div className="mt-4 pt-3 border-t border-border/50">
                  <CurriculumUploadDialog 
                    subjectId={subject.id} 
                    subjectName={subject.name}
                    trigger={
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full gap-2 text-primary hover:text-primary"
                        data-testid={`button-ai-import-card-${subject.id}`}
                      >
                        <Sparkles className="h-4 w-4" />
                        AI Import Lessons
                      </Button>
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-0 flex flex-wrap items-center gap-2">
                {(() => {
                  // Get students from subject_students junction table
                  if (subject.students && subject.students.length > 0) {
                    return subject.students.map((student) => (
                      <div 
                        key={student.id}
                        className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md"
                      >
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: student.color || '#6B7280' }}
                        />
                        {student.name}
                      </div>
                    ));
                  }
                  // Fallback to legacy single studentId
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
            </Link>
          ))}
          
          {filteredAndSortedSubjects.length === 0 && subjects && subjects.length > 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5">
              <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-bold">No matching subjects</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">Try adjusting your filters to see more subjects.</p>
              <Button 
                variant="outline"
                onClick={() => {
                  setStudentFilter("all");
                  setCategoryFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
          
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
