import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLessonSchema } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLesson, useUpdateLesson } from "@/hooks/use-lessons";
import { useSubjects } from "@/hooks/use-subjects";
import { useEffect, useState } from "react";
import { Plus, CalendarIcon } from "lucide-react";
import type { Lesson } from "@shared/schema";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  lesson?: Lesson;
  preselectedDate?: Date;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateLessonDialog({ lesson, preselectedDate, trigger, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  const { data: subjects } = useSubjects();
  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  
  const form = useForm({
    resolver: zodResolver(insertLessonSchema),
    defaultValues: {
      title: "",
      content: "",
      link: "",
      subjectId: 0,
      dateScheduled: format(new Date(), "yyyy-MM-dd"),
      completed: false,
    },
  });

  useEffect(() => {
    if (lesson) {
      form.reset({
        title: lesson.title,
        content: lesson.content || "",
        link: lesson.link || "",
        subjectId: lesson.subjectId,
        dateScheduled: lesson.dateScheduled,
        completed: lesson.completed || false,
      });
    } else if (preselectedDate) {
      form.setValue("dateScheduled", format(preselectedDate, "yyyy-MM-dd"));
    }
  }, [lesson, preselectedDate, form, isOpen]);

  const onSubmit = async (data: any) => {
    try {
      if (lesson) {
        await updateMutation.mutateAsync({ id: lesson.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsOpen?.(false);
      form.reset();
    } catch (error) {
      console.error(error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Schedule Lesson
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {lesson ? "Edit Lesson" : "Schedule New Lesson"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val))} 
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            {s.name}
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
                name="dateScheduled"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduction to Algebra" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Plan / Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Key concepts to cover..." 
                      className="min-h-[100px] resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource Link (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (lesson ? "Updating..." : "Scheduling...") : (lesson ? "Save Changes" : "Schedule Lesson")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
