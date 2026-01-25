import { AppLayout } from "@/components/AppLayout";
import { useFormContent, useDeleteFormContent } from "@/hooks/use-form-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, BookOpen, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { FORM_LABELS } from "@shared/schema";
import type { FormContent as FormContentType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { FormContentDialog } from "@/components/FormContentDialog";

export default function FormContent() {
  const { data: allContent, isLoading } = useFormContent();
  const deleteMutation = useDeleteFormContent();
  const { toast } = useToast();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const formFromUrl = searchParams.get("form");
  
  const [selectedForm, setSelectedForm] = useState("form_1");
  const [editingContent, setEditingContent] = useState<FormContentType | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Set initial form from URL query parameter
  useEffect(() => {
    if (formFromUrl && ["form_1", "form_2", "form_3"].includes(formFromUrl)) {
      setSelectedForm(formFromUrl);
    }
  }, [formFromUrl]);

  const filteredContent = allContent?.filter((c) => c.formLevel === selectedForm) || [];

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this content?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Content deleted" });
      } catch (error) {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    }
  };

  const handleEdit = (content: FormContentType) => {
    setEditingContent(content);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingContent(undefined);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6 gap-2">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Charlotte Mason Forms</h1>
          <p className="text-muted-foreground">Custom language arts curriculum with copywork and dictation prompts.</p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20" data-testid="button-add-content">
          <Plus className="h-4 w-4" /> Add Content
        </Button>
      </div>

      <Tabs value={selectedForm} onValueChange={setSelectedForm} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="form_1" data-testid="tab-form-1">Form 1 (Grades 1-3)</TabsTrigger>
          <TabsTrigger value="form_2" data-testid="tab-form-2">Form 2 (Grades 4-6)</TabsTrigger>
          <TabsTrigger value="form_3" data-testid="tab-form-3">Form 3 (Grades 7-9)</TabsTrigger>
        </TabsList>

        {["form_1", "form_2", "form_3"].map((formLevel) => (
          <TabsContent key={formLevel} value={formLevel}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredContent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-bold">No content for {FORM_LABELS[formLevel]}</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Add your first copywork and dictation content for this form level.
                </p>
                <Button onClick={handleCreate} data-testid="button-create-first-content">
                  Add Content
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredContent.map((content) => (
                  <Card key={content.id} className="group hover-elevate" data-testid={`card-content-${content.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-content-title-${content.id}`}>
                            {content.title}
                          </CardTitle>
                          {content.weekNumber && (
                            <CardDescription>Week {content.weekNumber}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-edit-content-${content.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(content.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          data-testid={`button-delete-content-${content.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {content.copywork && (
                        <div>
                          <Badge variant="secondary" className="mb-2">Copywork</Badge>
                          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg italic">
                            "{content.copywork}"
                          </p>
                        </div>
                      )}
                      {content.dictationPrompt && (
                        <div>
                          <Badge variant="secondary" className="mb-2">Dictation Prompt</Badge>
                          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            {content.dictationPrompt}
                          </p>
                        </div>
                      )}
                      {content.notes && (
                        <div>
                          <Badge variant="outline" className="mb-2">Notes</Badge>
                          <p className="text-sm text-muted-foreground">{content.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <FormContentDialog
        content={editingContent}
        defaultFormLevel={selectedForm}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </AppLayout>
  );
}
