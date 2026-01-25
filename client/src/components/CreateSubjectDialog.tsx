import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateSubject, useUpdateSubject } from "@/hooks/use-subjects";
import { useStudents } from "@/hooks/use-students";
import { useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Subject } from "@shared/schema";
import { CurriculumUploadDialog } from "./CurriculumUploadDialog";
import { SUBJECT_CATEGORIES, SUBJECT_CATEGORY_COLORS, CHARLOTTE_MASON_FORMS, FORM_LABELS, CURRICULUM_OPTIONS, CURRICULUM_CATEGORY_LABELS } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

const SUBJECT_CATEGORY_LABELS: Record<string, string> = {
  language_arts: "Language Arts",
  math: "Math",
  science: "Science",
  history: "History",
  art: "Art",
  music: "Music",
  physical_education: "Physical Education",
  foreign_language: "Foreign Language",
  other: "Other",
};

interface Props {
  subject?: Subject;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preselectedCurriculum?: { name: string; category: string; grades: string } | null;
}

export function CreateSubjectDialog({ subject, trigger, open, onOpenChange, preselectedCurriculum }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  
  const [importWithAI, setImportWithAI] = useState(false);
  const [aiImportDialogOpen, setAiImportDialogOpen] = useState(false);
  const [createdSubject, setCreatedSubject] = useState<Subject | null>(null);

  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const { data: students } = useStudents();
  
  const form = useForm({
    resolver: zodResolver(insertSubjectSchema),
    defaultValues: {
      name: "",
      description: "",
      scheduledDays: [1, 2, 3, 4, 5],
      totalLessons: 180,
      startLesson: 1,
      curriculumSource: "",
      gradeLevel: "",
      studentId: undefined as number | undefined,
      category: "other",
      formLevel: "",
      unitStudy: "",
    },
  });
  
  const selectedCategory = form.watch("category");
  const watchedTotalLessons = form.watch("totalLessons");

  useEffect(() => {
    if (subject) {
      form.reset({
        name: subject.name,
        description: subject.description || "",
        scheduledDays: subject.scheduledDays || [1, 2, 3, 4, 5],
        totalLessons: subject.totalLessons || 180,
        startLesson: subject.startLesson || 1,
        curriculumSource: subject.curriculumSource || "",
        gradeLevel: subject.gradeLevel || "",
        studentId: subject.studentId || undefined,
        category: subject.category || "other",
        formLevel: subject.formLevel || "",
        unitStudy: subject.unitStudy || "",
      });
    } else if (preselectedCurriculum) {
      const gradeMatch = preselectedCurriculum.grades.match(/^([K0-9]+)/);
      const startGrade = gradeMatch ? gradeMatch[1] : "";
      form.reset({
        name: preselectedCurriculum.name,
        description: "",
        scheduledDays: [1, 2, 3, 4, 5],
        totalLessons: 180,
        startLesson: 1,
        curriculumSource: preselectedCurriculum.name,
        gradeLevel: startGrade,
        studentId: undefined,
        category: preselectedCurriculum.category,
        formLevel: "",
        unitStudy: "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        scheduledDays: [1, 2, 3, 4, 5],
        totalLessons: 180,
        startLesson: 1,
        curriculumSource: "",
        gradeLevel: "",
        studentId: undefined,
        category: "other",
        formLevel: "",
        unitStudy: "",
      });
    }
  }, [subject, form, isOpen, preselectedCurriculum]);

  const onSubmit = async (data: any) => {
    console.log("Form submitted with data:", data);
    try {
      const payload = {
        ...data,
        curriculumSource: data.curriculumSource === "NONE" ? null : data.curriculumSource || null,
        gradeLevel: data.gradeLevel || null,
        studentId: data.studentId || null,
        category: data.category || "other",
        formLevel: data.formLevel && data.formLevel !== "none" ? data.formLevel : null,
        unitStudy: data.unitStudy || null,
        startLesson: data.startLesson || 1,
      };
      console.log("Sending payload:", payload);
      if (subject) {
        await updateMutation.mutateAsync({ id: subject.id, ...payload });
        setIsOpen?.(false);
      } else {
        const newSubject = await createMutation.mutateAsync(payload);
        if (importWithAI && newSubject) {
          setCreatedSubject(newSubject as Subject);
          setIsOpen?.(false);
          setTimeout(() => setAiImportDialogOpen(true), 100);
        } else {
          setIsOpen?.(false);
        }
      }
      form.reset();
      setImportWithAI(false);
    } catch (error: any) {
      console.error("Submit error:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create subject";
      alert(errorMessage);
    }
  };

  // Log form errors for debugging
  const formErrors = form.formState.errors;
  if (Object.keys(formErrors).length > 0) {
    console.log("Form validation errors:", formErrors);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const grades = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const days = [
    { label: "S", value: 0 },
    { label: "M", value: 1 },
    { label: "T", value: 2 },
    { label: "W", value: 3 },
    { label: "T", value: 4 },
    { label: "F", value: 5 },
    { label: "S", value: 6 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Subject
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {subject ? "Edit Subject" : "New Subject"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {students && students.length > 0 && (
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} 
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-student">
                          <SelectValue placeholder="Select Student" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Mathematics, History, etc." {...field} data-testid="input-subject-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "other"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-subject-category">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBJECT_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-3 w-3 rounded-full" 
                              style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[category] }}
                            />
                            {SUBJECT_CATEGORY_LABELS[category]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedCategory === "language_arts" && (
              <FormField
                control={form.control}
                name="formLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charlotte Mason Form (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-form-level">
                          <SelectValue placeholder="Select Form Level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Form</SelectItem>
                        {CHARLOTTE_MASON_FORMS.map((form) => (
                          <SelectItem key={form} value={form}>
                            {FORM_LABELS[form]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gradeLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Grade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {grades.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            Grade {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="curriculumSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Curriculum</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Curriculum" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-80">
                        <SelectItem value="NONE">Custom / Manual</SelectItem>
                        {Object.entries(CURRICULUM_OPTIONS).map(([category, curricula]) => (
                          <SelectGroup key={category}>
                            <SelectLabel className="text-xs font-semibold text-primary">
                              {CURRICULUM_CATEGORY_LABELS[category]}
                            </SelectLabel>
                            {curricula.map((item) => (
                              <SelectItem key={item.name} value={item.name}>
                                {item.name} ({item.grades})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What topics will be covered?" 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unitStudy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Study (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Ancient Egypt, Oceans, Weather" 
                      {...field} 
                      data-testid="input-unit-study"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="totalLessons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Lessons</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startLesson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start at Lesson</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        max={watchedTotalLessons || 180}
                        {...field} 
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          const max = watchedTotalLessons || 180;
                          field.onChange(Math.min(Math.max(1, val), max));
                        }} 
                        data-testid="input-start-lesson"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduledDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Days</FormLabel>
                    <div className="flex gap-1">
                      {days.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={field.value.includes(day.value) ? "default" : "outline"}
                          className="h-8 w-8 p-0 text-xs"
                          onClick={() => {
                            const newValue = field.value.includes(day.value)
                              ? field.value.filter((v: number) => v !== day.value)
                              : [...field.value, day.value];
                            field.onChange(newValue);
                          }}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!subject && (
              <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="importWithAI"
                  checked={importWithAI}
                  onCheckedChange={(checked) => setImportWithAI(checked === true)}
                  data-testid="checkbox-import-with-ai"
                />
                <div className="flex-1">
                  <label 
                    htmlFor="importWithAI" 
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    Import lessons from PDF or image
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use AI to extract lessons from your curriculum's table of contents
                  </p>
                </div>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (subject ? "Updating..." : "Creating...") : (subject ? "Save Changes" : "Create Subject")}
            </Button>
          </form>
        </Form>
      </DialogContent>
      {createdSubject && (
        <CurriculumUploadDialog
          subjectId={createdSubject.id}
          subjectName={createdSubject.name}
          trigger={<span style={{ display: 'none' }} />}
          externalOpen={aiImportDialogOpen}
          onExternalOpenChange={(open) => {
            setAiImportDialogOpen(open);
            if (!open) setCreatedSubject(null);
          }}
        />
      )}
    </Dialog>
  );
}
