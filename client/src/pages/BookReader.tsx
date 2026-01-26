import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ArrowLeft, Loader2, PenLine, BookMarked, ExternalLink } from "lucide-react";
import type { LibraryItem, Subject, Lesson } from "@shared/schema";

export default function BookReader() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [bookContent, setBookContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assignmentType, setAssignmentType] = useState<"copywork" | "reading">("copywork");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);

  const { data: libraryItem, isLoading: isLoadingItem } = useQuery<LibraryItem>({
    queryKey: ["/api/library", id],
    enabled: !!id,
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", { subjectId: selectedSubjectId }],
    enabled: !!selectedSubjectId,
  });

  const createResourceMutation = useMutation({
    mutationFn: async (data: { lessonId: number; title: string; url: string; type: string; description: string }) => {
      return apiRequest("POST", "/api/lessons/resources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({ title: "Assignment created successfully!" });
      setShowAssignmentDialog(false);
      setSelectedText("");
    },
    onError: () => {
      toast({ title: "Failed to create assignment", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (libraryItem?.source === "gutenberg" && libraryItem.sourceId) {
      loadGutenbergContent(libraryItem.sourceId);
    }
  }, [libraryItem]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="book-content"]') && 
          !target.closest('[data-floating-toolbar]') &&
          !showAssignmentDialog) {
        setSelectedText("");
        setSelectionPosition(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssignmentDialog]);

  const loadGutenbergContent = async (sourceId: string) => {
    setIsLoadingContent(true);
    try {
      const response = await fetch(`/api/library/gutenberg-content/${sourceId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Could not load book content");
      }
      const text = await response.text();
      setBookContent(text);
    } catch (error) {
      console.error("Failed to load book content:", error);
      toast({ 
        title: "Could not load book content", 
        description: "You can still view the book on the original website.",
        variant: "destructive" 
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      setSelectedText(text);
      
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    } else {
      if (!showAssignmentDialog) {
        setSelectedText("");
        setSelectionPosition(null);
      }
    }
  };

  const handleCreateAssignment = () => {
    setShowAssignmentDialog(true);
  };

  const handleSaveAssignment = () => {
    if (!selectedLessonId || !selectedText) {
      toast({ title: "Please select a lesson", variant: "destructive" });
      return;
    }

    const title = assignmentType === "copywork" 
      ? `Copywork: ${libraryItem?.title}` 
      : `Reading: ${libraryItem?.title}`;
    
    const description = `${assignmentType === "copywork" ? "Copy this passage" : "Read aloud"}:\n\n"${selectedText}"`;

    createResourceMutation.mutate({
      lessonId: parseInt(selectedLessonId),
      title,
      url: libraryItem?.externalUrl || libraryItem?.fileUrl || "#",
      type: "document",
      description,
    });
  };

  const filteredLessons = lessons.filter(l => !l.completed);

  if (isLoadingItem) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!libraryItem) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium">Book not found</h2>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/library")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/library")} data-testid="button-back-to-library">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{libraryItem.title}</h1>
              {libraryItem.author && (
                <p className="text-sm text-muted-foreground">by {libraryItem.author}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {libraryItem.externalUrl && (
              <Button variant="outline" onClick={() => window.open(libraryItem.externalUrl!, "_blank")} data-testid="button-open-external">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Original
              </Button>
            )}
          </div>
        </div>

        {selectedText && selectionPosition && !showAssignmentDialog && (
          <div 
            data-floating-toolbar
            className="fixed z-50 bg-background border rounded-lg shadow-lg p-2 flex gap-2"
            style={{ 
              left: Math.max(10, Math.min(selectionPosition.x - 100, window.innerWidth - 220)),
              top: Math.max(10, selectionPosition.y - 50),
            }}
          >
            <Button size="sm" onClick={handleCreateAssignment} data-testid="button-create-copywork">
              <PenLine className="h-4 w-4 mr-2" />
              Create Copywork
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAssignmentType("reading"); handleCreateAssignment(); }} data-testid="button-create-reading">
              <BookMarked className="h-4 w-4 mr-2" />
              Reading Assignment
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            {isLoadingContent ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-muted-foreground">Loading book content...</p>
              </div>
            ) : bookContent ? (
              <div 
                className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap font-serif leading-relaxed"
                onMouseUp={handleTextSelection}
                onTouchEnd={handleTextSelection}
                data-testid="book-content"
              >
                {bookContent}
              </div>
            ) : libraryItem.source === "gutenberg" ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Unable to load book content directly.</p>
                <Button onClick={() => window.open(libraryItem.externalUrl!, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read on Project Gutenberg
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  This library item doesn't have readable content.
                </p>
                {libraryItem.externalUrl && (
                  <Button className="mt-4" onClick={() => window.open(libraryItem.externalUrl!, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open External Link
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create {assignmentType === "copywork" ? "Copywork" : "Reading"} Assignment
            </DialogTitle>
            <DialogDescription>
              Add this passage to a lesson as {assignmentType === "copywork" ? "copywork practice" : "a reading assignment"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Passage</Label>
              <div className="p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                "{selectedText}"
              </div>
              <p className="text-xs text-muted-foreground">{selectedText.length} characters</p>
            </div>

            <div className="space-y-2">
              <Label>Assignment Type</Label>
              <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as "copywork" | "reading")}>
                <SelectTrigger data-testid="select-assignment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copywork">Copywork - Student copies the passage</SelectItem>
                  <SelectItem value="reading">Reading Aloud - Student reads the passage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger data-testid="select-subject">
                  <SelectValue placeholder="Select a subject..." />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSubjectId && (
              <div className="space-y-2">
                <Label>Lesson</Label>
                <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                  <SelectTrigger data-testid="select-lesson">
                    <SelectValue placeholder="Select a lesson..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredLessons.length === 0 ? (
                      <SelectItem value="none" disabled>No upcoming lessons</SelectItem>
                    ) : (
                      filteredLessons.map((lesson) => (
                        <SelectItem key={lesson.id} value={String(lesson.id)}>
                          {lesson.title} - {lesson.dateScheduled ? new Date(lesson.dateScheduled).toLocaleDateString() : "Not scheduled"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAssignment} 
              disabled={!selectedLessonId || createResourceMutation.isPending}
              data-testid="button-save-assignment"
            >
              {createResourceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PenLine className="h-4 w-4 mr-2" />
              )}
              Add to Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
