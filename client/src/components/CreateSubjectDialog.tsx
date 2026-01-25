import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSubject, useUpdateSubject } from "@/hooks/use-subjects";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Subject } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  subject?: Subject;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const COMMON_CURRICULUM = [
  { label: "Custom / Manual", value: "" },
  { label: "Saxon Math", value: "Saxon Math" },
  { label: "The Good and the Beautiful", value: "The Good and the Beautiful" },
  { label: "Master Books", value: "Master Books" },
  { label: "Abeka", value: "Abeka" },
];

export function CreateSubjectDialog({ subject, trigger, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  
  const form = useForm({
    resolver: zodResolver(insertSubjectSchema),
    defaultValues: {
      name: "",
      description: "",
      scheduledDays: [1, 2, 3, 4, 5],
      totalLessons: 180,
      curriculumSource: "",
      gradeLevel: "",
    },
  });

  useEffect(() => {
    if (subject) {
      form.reset({
        name: subject.name,
        description: subject.description || "",
        scheduledDays: subject.scheduledDays || [1, 2, 3, 4, 5],
        totalLessons: subject.totalLessons || 180,
        curriculumSource: subject.curriculumSource || "",
        gradeLevel: subject.gradeLevel || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        scheduledDays: [1, 2, 3, 4, 5],
        totalLessons: 180,
        curriculumSource: "",
        gradeLevel: "",
      });
    }
  }, [subject, form, isOpen]);

  const onSubmit = async (data: any) => {
    console.log("Form submitted with data:", data);
    try {
      const payload = {
        ...data,
        curriculumSource: data.curriculumSource === "NONE" ? null : data.curriculumSource || null,
        gradeLevel: data.gradeLevel || null,
      };
      console.log("Sending payload:", payload);
      if (subject) {
        await updateMutation.mutateAsync({ id: subject.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setIsOpen?.(false);
      form.reset();
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {subject ? "Edit Subject" : "New Subject"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Mathematics, History, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      <SelectContent>
                        {COMMON_CURRICULUM.map((item) => (
                          <SelectItem key={item.value || "manual"} value={item.value || "NONE"}>
                            {item.label}
                          </SelectItem>
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
            <div className="grid grid-cols-2 gap-4">
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
    </Dialog>
  );
}
