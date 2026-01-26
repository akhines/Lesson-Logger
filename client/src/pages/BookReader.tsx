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
import { BookOpen, ArrowLeft, Loader2, PenLine, BookMarked, ExternalLink, HelpCircle, Sparkles, Copy, Check, Plus, CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { LibraryItem, Subject, Lesson, Student } from "@shared/schema";

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
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [lessonMode, setLessonMode] = useState<"existing" | "new">("existing");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDate, setNewLessonDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  
  // Separate state for questions dialog to avoid cross-dialog interference
  const [questionsLessonMode, setQuestionsLessonMode] = useState<"existing" | "new">("existing");
  const [questionsSubjectId, setQuestionsSubjectId] = useState<string>("");
  const [questionsLessonId, setQuestionsLessonId] = useState<string>("");
  const [questionsNewTitle, setQuestionsNewTitle] = useState("");
  const [questionsNewDate, setQuestionsNewDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const { data: libraryItem, isLoading: isLoadingItem } = useQuery<LibraryItem>({
    queryKey: ["/api/library", id],
    enabled: !!id,
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: [`/api/lessons?subjectId=${selectedSubjectId}`],
    enabled: !!selectedSubjectId,
  });

  // Separate query for lessons in the questions dialog
  const { data: questionsLessons = [] } = useQuery<Lesson[]>({
    queryKey: [`/api/lessons?subjectId=${questionsSubjectId}`],
    enabled: !!questionsSubjectId,
  });

  // Subjects already come with their students populated from the API
  type SubjectWithStudents = Subject & { students?: Student[] };
  const subjectsWithStudents = subjects as SubjectWithStudents[];

  // Get students assigned to the selected subject
  const getStudentsForSubject = (subjectId: number): Student[] => {
    const subject = subjectsWithStudents.find(s => s.id === subjectId);
    return subject?.students || [];
  };

  const createLessonMutation = useMutation({
    mutationFn: async (data: { title: string; content: string | null; subjectId: number; dateScheduled: string; completed: boolean }) => {
      const response = await apiRequest("POST", "/api/lessons", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
    },
    onError: () => {
      toast({ title: "Failed to create lesson", variant: "destructive" });
    },
  });

  const createResourceMutation = useMutation({
    mutationFn: async (data: { lessonId: number; title: string; url: string; type: string; description: string }) => {
      return apiRequest("POST", "/api/lesson-resources", data);
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
    // Reset create new lesson fields
    setNewLessonTitle(assignmentType === "copywork" 
      ? `Copywork: ${libraryItem?.title || ""}` 
      : `Reading: ${libraryItem?.title || ""}`);
    setNewLessonDate(new Date().toISOString().split("T")[0]);
    setSelectedStudentIds([]);
    setShowAssignmentDialog(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedText) {
      toast({ title: "Please select some text", variant: "destructive" });
      return;
    }

    const title = assignmentType === "copywork" 
      ? `Copywork: ${libraryItem?.title}` 
      : `Reading: ${libraryItem?.title}`;
    
    const description = `${assignmentType === "copywork" ? "Copy this passage" : "Read aloud"}:\n\n"${selectedText}"`;

    if (lessonMode === "new") {
      // Create new lesson mode
      if (!selectedSubjectId || !newLessonTitle.trim() || !newLessonDate) {
        toast({ title: "Please fill in all lesson details", variant: "destructive" });
        return;
      }

      try {
        // If students are selected, create a lesson for each student's subject
        // The subject is linked via subject_students, so the lesson just goes to the subject
        const lessonResponse = await createLessonMutation.mutateAsync({
          title: newLessonTitle.trim(),
          content: null,
          subjectId: parseInt(selectedSubjectId),
          dateScheduled: newLessonDate,
          completed: false,
        });

        // Add the resource to the new lesson
        await createResourceMutation.mutateAsync({
          lessonId: (lessonResponse as any).id,
          title,
          url: libraryItem?.externalUrl || libraryItem?.fileUrl || "#",
          type: "document",
          description,
        });

        toast({ title: "Lesson created with assignment!" });
        setShowAssignmentDialog(false);
        setSelectedText("");
      } catch (error) {
        toast({ title: "Failed to create lesson", variant: "destructive" });
      }
    } else {
      // Existing lesson mode
      if (!selectedLessonId) {
        toast({ title: "Please select a lesson", variant: "destructive" });
        return;
      }

      createResourceMutation.mutate({
        lessonId: parseInt(selectedLessonId),
        title,
        url: libraryItem?.externalUrl || libraryItem?.fileUrl || "#",
        type: "document",
        description,
      });
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedText) return;
    
    setIsGeneratingQuestions(true);
    setShowQuestionsDialog(true);
    setGeneratedQuestions([]);
    
    try {
      const response = await fetch("/api/library/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: selectedText }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }
      
      const data = await response.json();
      setGeneratedQuestions(data.questions || []);
    } catch (error) {
      toast({ title: "Failed to generate questions", variant: "destructive" });
      setShowQuestionsDialog(false);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const copyQuestion = (question: string, index: number) => {
    navigator.clipboard.writeText(question);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "Question copied to clipboard" });
  };

  const addQuestionsToLesson = async () => {
    if (generatedQuestions.length === 0) {
      toast({ title: "No questions to add", variant: "destructive" });
      return;
    }

    const questionsText = generatedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n\n");
    const description = `Comprehension Questions:\n\n${questionsText}\n\n---\nBased on passage:\n"${selectedText.substring(0, 200)}${selectedText.length > 200 ? "..." : ""}"`;

    if (questionsLessonMode === "new") {
      // Create new lesson mode
      if (!questionsSubjectId || !questionsNewTitle.trim() || !questionsNewDate) {
        toast({ title: "Please fill in all lesson details", variant: "destructive" });
        return;
      }

      try {
        const lessonResponse = await createLessonMutation.mutateAsync({
          title: questionsNewTitle.trim(),
          content: null,
          subjectId: parseInt(questionsSubjectId),
          dateScheduled: questionsNewDate,
          completed: false,
        });

        await createResourceMutation.mutateAsync({
          lessonId: (lessonResponse as any).id,
          title: `Comprehension: ${libraryItem?.title}`,
          url: libraryItem?.externalUrl || libraryItem?.fileUrl || "#",
          type: "document",
          description,
        });

        toast({ title: "Lesson created with comprehension questions!" });
        setShowQuestionsDialog(false);
        resetQuestionsDialogState();
      } catch (error) {
        toast({ title: "Failed to create lesson", variant: "destructive" });
      }
    } else {
      // Existing lesson mode
      if (!questionsLessonId) {
        toast({ title: "Please select a lesson", variant: "destructive" });
        return;
      }

      createResourceMutation.mutate({
        lessonId: parseInt(questionsLessonId),
        title: `Comprehension: ${libraryItem?.title}`,
        url: libraryItem?.externalUrl || libraryItem?.fileUrl || "#",
        type: "document",
        description,
      });
      setShowQuestionsDialog(false);
      resetQuestionsDialogState();
    }
  };
  
  const resetQuestionsDialogState = () => {
    setQuestionsLessonMode("existing");
    setQuestionsSubjectId("");
    setQuestionsLessonId("");
    setQuestionsNewTitle("");
    setQuestionsNewDate(new Date().toISOString().split("T")[0]);
  };

  const filteredLessons = lessons.filter(l => !l.completed);
  const filteredQuestionsLessons = questionsLessons.filter(l => !l.completed);

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

        {selectedText && selectionPosition && !showAssignmentDialog && !showQuestionsDialog && (
          <div 
            data-floating-toolbar
            className="fixed z-50 bg-background border rounded-lg shadow-lg p-2 flex flex-wrap gap-2"
            style={{ 
              left: Math.max(10, Math.min(selectionPosition.x - 150, window.innerWidth - 320)),
              top: Math.max(10, selectionPosition.y - 50),
            }}
          >
            <Button size="sm" onClick={handleCreateAssignment} data-testid="button-create-copywork">
              <PenLine className="h-4 w-4 mr-2" />
              Copywork
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAssignmentType("reading"); handleCreateAssignment(); }} data-testid="button-create-reading">
              <BookMarked className="h-4 w-4 mr-2" />
              Reading
            </Button>
            <Button size="sm" variant="secondary" onClick={handleGenerateQuestions} data-testid="button-generate-questions">
              <Sparkles className="h-4 w-4 mr-2" />
              Questions
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Select value={selectedSubjectId} onValueChange={(val) => { setSelectedSubjectId(val); setSelectedLessonId(""); }}>
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
              {selectedSubjectId && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {getStudentsForSubject(parseInt(selectedSubjectId)).map((student) => (
                    <Badge key={student.id} variant="secondary" style={{ backgroundColor: student.color || undefined }}>
                      {student.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {selectedSubjectId && (
              <Tabs value={lessonMode} onValueChange={(v) => setLessonMode(v as "existing" | "new")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing" data-testid="tab-existing-lesson">Add to Existing</TabsTrigger>
                  <TabsTrigger value="new" data-testid="tab-new-lesson">
                    <Plus className="h-4 w-4 mr-1" />
                    Create New Lesson
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="existing" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Select Lesson</Label>
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
                </TabsContent>
                
                <TabsContent value="new" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Lesson Title</Label>
                    <Input
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      placeholder="Enter lesson title..."
                      data-testid="input-new-lesson-title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={newLessonDate}
                      onChange={(e) => setNewLessonDate(e.target.value)}
                      data-testid="input-new-lesson-date"
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    This lesson will be assigned to all students linked to the selected subject.
                  </p>
                </TabsContent>
              </Tabs>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAssignment} 
              disabled={(lessonMode === "existing" && !selectedLessonId) || 
                        (lessonMode === "new" && (!newLessonTitle.trim() || !selectedSubjectId)) || 
                        createResourceMutation.isPending || 
                        createLessonMutation.isPending}
              data-testid="button-save-assignment"
            >
              {(createResourceMutation.isPending || createLessonMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : lessonMode === "new" ? (
                <Plus className="h-4 w-4 mr-2" />
              ) : (
                <PenLine className="h-4 w-4 mr-2" />
              )}
              {lessonMode === "new" ? "Create Lesson" : "Add to Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehension Questions Dialog */}
      <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="questions-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Comprehension Questions
            </DialogTitle>
            <DialogDescription>
              AI-generated questions based on the selected passage. Copy individual questions or add all to a lesson.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isGeneratingQuestions ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-muted-foreground">Generating questions...</p>
              </div>
            ) : generatedQuestions.length > 0 ? (
              <>
                <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground mb-4">
                  <strong>Selected passage:</strong> "{selectedText.substring(0, 150)}{selectedText.length > 150 ? "..." : ""}"
                </div>
                <div className="space-y-3">
                  {generatedQuestions.map((question, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg hover-elevate">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <p className="flex-1 text-sm">{question}</p>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => copyQuestion(question, index)}
                        data-testid={`button-copy-question-${index}`}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <Label className="text-sm font-medium mb-2 block">Add all questions to a lesson:</Label>
                  <Tabs value={questionsLessonMode} onValueChange={(v) => setQuestionsLessonMode(v as "existing" | "new")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing" data-testid="questions-tab-existing">Existing Lesson</TabsTrigger>
                      <TabsTrigger value="new" data-testid="questions-tab-new">
                        <Plus className="h-3 w-3 mr-1" />
                        New Lesson
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="existing" className="space-y-3 mt-3">
                      <Select value={questionsSubjectId} onValueChange={(val) => { setQuestionsSubjectId(val); setQuestionsLessonId(""); }}>
                        <SelectTrigger data-testid="questions-select-subject">
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
                      
                      {questionsSubjectId && (
                        <Select value={questionsLessonId} onValueChange={setQuestionsLessonId}>
                          <SelectTrigger data-testid="questions-select-lesson">
                            <SelectValue placeholder="Select a lesson..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredQuestionsLessons.length === 0 ? (
                              <SelectItem value="none" disabled>No upcoming lessons</SelectItem>
                            ) : (
                              filteredQuestionsLessons.map((lesson) => (
                                <SelectItem key={lesson.id} value={String(lesson.id)}>
                                  {lesson.title} - {lesson.dateScheduled ? new Date(lesson.dateScheduled).toLocaleDateString() : "Not scheduled"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </TabsContent>

                    <TabsContent value="new" className="space-y-3 mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Lesson Title</Label>
                        <Input
                          value={questionsNewTitle}
                          onChange={(e) => setQuestionsNewTitle(e.target.value)}
                          placeholder="Enter lesson title..."
                          data-testid="questions-input-lesson-title"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <Select value={questionsSubjectId} onValueChange={setQuestionsSubjectId}>
                          <SelectTrigger data-testid="questions-new-select-subject">
                            <SelectValue placeholder="Select a subject..." />
                          </SelectTrigger>
                          <SelectContent>
                            {subjectsWithStudents.map((subject) => (
                              <SelectItem key={subject.id} value={String(subject.id)}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {questionsSubjectId && getStudentsForSubject(parseInt(questionsSubjectId)).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {getStudentsForSubject(parseInt(questionsSubjectId)).map((student) => (
                              <Badge
                                key={student.id}
                                variant="secondary"
                                className="text-xs"
                                style={{ backgroundColor: student.color ? `${student.color}20` : undefined, borderColor: student.color || undefined }}
                              >
                                {student.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={questionsNewDate}
                          onChange={(e) => setQuestionsNewDate(e.target.value)}
                          data-testid="questions-input-lesson-date"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No questions generated yet.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowQuestionsDialog(false); resetQuestionsDialogState(); }}>
              Close
            </Button>
            {generatedQuestions.length > 0 && (
              <Button 
                onClick={addQuestionsToLesson} 
                disabled={(questionsLessonMode === "existing" && !questionsLessonId) ||
                          (questionsLessonMode === "new" && (!questionsNewTitle.trim() || !questionsSubjectId)) ||
                          createResourceMutation.isPending ||
                          createLessonMutation.isPending}
                data-testid="button-add-questions-to-lesson"
              >
                {(createResourceMutation.isPending || createLessonMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : questionsLessonMode === "new" ? (
                  <Plus className="h-4 w-4 mr-2" />
                ) : (
                  <HelpCircle className="h-4 w-4 mr-2" />
                )}
                {questionsLessonMode === "new" ? "Create Lesson" : "Add to Lesson"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
