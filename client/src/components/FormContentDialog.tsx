import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCreateFormContent, useUpdateFormContent } from "@/hooks/use-form-content";
import { CHARLOTTE_MASON_FORMS, FORM_LABELS } from "@shared/schema";
import type { FormContent } from "@shared/schema";

const formSchema = z.object({
  formLevel: z.string().min(1, "Form level is required"),
  title: z.string().min(1, "Title is required"),
  weekNumber: z.coerce.number().optional().nullable(),
  copywork: z.string().optional().nullable(),
  dictationPrompt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface FormContentDialogProps {
  content?: FormContent;
  defaultFormLevel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormContentDialog({
  content,
  defaultFormLevel = "form_1",
  open,
  onOpenChange,
}: FormContentDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateFormContent();
  const updateMutation = useUpdateFormContent();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      formLevel: content?.formLevel || defaultFormLevel,
      title: content?.title || "",
      weekNumber: content?.weekNumber || null,
      copywork: content?.copywork || "",
      dictationPrompt: content?.dictationPrompt || "",
      notes: content?.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        formLevel: content?.formLevel || defaultFormLevel,
        title: content?.title || "",
        weekNumber: content?.weekNumber || null,
        copywork: content?.copywork || "",
        dictationPrompt: content?.dictationPrompt || "",
        notes: content?.notes || "",
      });
    }
  }, [open, content, defaultFormLevel, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (content) {
        await updateMutation.mutateAsync({
          id: content.id,
          data: values,
        });
        toast({ title: "Content updated" });
      } else {
        await createMutation.mutateAsync(values);
        toast({ title: "Content created" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save content",
        variant: "destructive",
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content ? "Edit Content" : "Add Content"}</DialogTitle>
          <DialogDescription>
            Create copywork and dictation content for Charlotte Mason language arts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="formLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Form Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-form-level">
                          <SelectValue placeholder="Select form" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              <FormField
                control={form.control}
                name="weekNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Week Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 1"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        data-testid="input-week-number"
                      />
                    </FormControl>
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
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Week 1 - Nature Study"
                      {...field}
                      data-testid="input-content-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="copywork"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Copywork</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the text for students to copy..."
                      className="min-h-[100px] resize-none"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-copywork"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dictationPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Written Dictation Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the dictation text that will be read aloud to students..."
                      className="min-h-[100px] resize-none"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-dictation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes for parents..."
                      className="min-h-[60px] resize-none"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-content">
                {isSubmitting ? "Saving..." : content ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
