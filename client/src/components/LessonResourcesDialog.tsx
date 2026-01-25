import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Link2, Video, FileText, File, Trash2, Plus, ExternalLink } from "lucide-react";
import type { LessonResource } from "@shared/schema";

interface Props {
  lessonId: number;
  lessonTitle: string;
  trigger?: React.ReactNode;
}

const RESOURCE_TYPES = [
  { value: "link", label: "Link", icon: Link2 },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
  { value: "worksheet", label: "Worksheet", icon: File },
];

export function LessonResourcesDialog({ lessonId, lessonTitle, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: resources, isLoading } = useQuery<LessonResource[]>({
    queryKey: ["/api/lesson-resources", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/lesson-resources?lessonId=${lessonId}`);
      return res.json();
    },
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { lessonId: number; title: string; url: string; type: string; description?: string }) => {
      return apiRequest("POST", "/api/lesson-resources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-resources", lessonId] });
      setShowAddForm(false);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/lesson-resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-resources", lessonId] });
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      url: "",
      type: "link",
      description: "",
    },
  });

  const onSubmit = async (data: { title: string; url: string; type: string; description?: string }) => {
    await createMutation.mutateAsync({ ...data, lessonId });
  };

  const getIcon = (type: string) => {
    const resourceType = RESOURCE_TYPES.find(t => t.value === type);
    const Icon = resourceType?.icon || Link2;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-resources-${lessonId}`}>
            <Link2 className="h-4 w-4" />
            Resources
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">
            Resources for {lessonTitle}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-md" />
              ))}
            </div>
          ) : resources && resources.length > 0 ? (
            <div className="space-y-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/5"
                  data-testid={`resource-item-${resource.id}`}
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    {getIcon(resource.type || "link")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{resource.title}</div>
                    {resource.description && (
                      <div className="text-xs text-muted-foreground truncate">{resource.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(resource.id)}
                      data-testid={`button-delete-resource-${resource.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No resources linked to this lesson yet.
            </div>
          )}

          {showAddForm ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 border-t pt-4">
                <FormField
                  control={form.control}
                  name="title"
                  rules={{ required: "Title is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Khan Academy Video" {...field} data-testid="input-resource-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  rules={{ required: "URL is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} data-testid="input-resource-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-resource-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESOURCE_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-save-resource">
                    {createMutation.isPending ? "Adding..." : "Add Resource"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Button 
              variant="outline" 
              className="w-full gap-2" 
              onClick={() => setShowAddForm(true)}
              data-testid="button-add-resource"
            >
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
