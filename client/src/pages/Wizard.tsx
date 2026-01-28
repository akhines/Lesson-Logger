import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Plus, 
  Trash2, 
  Loader2, 
  Sparkles,
  MessageCircle,
  BookOpen,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Student, Subject, Lesson } from "@shared/schema";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  messages?: Message[];
}

export default function Wizard() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Text selection state for Add to Lesson feature
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showAddToLessonDialog, setShowAddToLessonDialog] = useState(false);
  
  // Lesson creation state
  const [lessonMode, setLessonMode] = useState<"new" | "existing">("new");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/wizard/conversations"],
  });

  const { data: currentConversation, isLoading: messagesLoading } = useQuery<Conversation>({
    queryKey: ["/api/wizard/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  // Queries for Add to Lesson feature
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  // Filter subjects for selected student (subjects API returns students array from subject_students table)
  const studentSubjects = selectedStudentId 
    ? subjects.filter(s => {
        // Check students array populated by the subjects API
        const students = (s as any).students as { id: number }[] | undefined;
        return students?.some?.(st => st.id === parseInt(selectedStudentId));
      })
    : [];

  // Fetch lessons for selected subject
  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", "subject", selectedSubjectId],
    enabled: !!selectedSubjectId && lessonMode === "existing",
  });

  // Create new lesson mutation
  const createLessonMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; subjectId: number }) => {
      return await apiRequest("POST", "/api/lessons", {
        ...data,
        completed: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({
        title: "Lesson Created",
        description: "The text has been added as a new lesson.",
      });
      resetLessonDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lesson",
        variant: "destructive",
      });
    },
  });

  // Update existing lesson mutation - fetches current content first to safely append
  const updateLessonMutation = useMutation({
    mutationFn: async (data: { lessonId: number; newContent: string }) => {
      // First fetch the current lesson to get its existing content
      const currentLesson = await fetch(`/api/lessons/${data.lessonId}`);
      if (!currentLesson.ok) throw new Error("Failed to fetch lesson");
      const lessonData = await currentLesson.json();
      
      // Append new content to existing content
      const existingContent = lessonData.content || "";
      const combinedContent = existingContent 
        ? `${existingContent}\n\n${data.newContent}`
        : data.newContent;
      
      return await apiRequest("PATCH", `/api/lessons/${data.lessonId}`, {
        content: combinedContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({
        title: "Lesson Updated",
        description: "The text has been added to the lesson.",
      });
      resetLessonDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lesson",
        variant: "destructive",
      });
    },
  });

  const resetLessonDialog = () => {
    setShowAddToLessonDialog(false);
    setSelectedText("");
    setSelectionPos(null);
    setLessonMode("new");
    setSelectedStudentId("");
    setSelectedSubjectId("");
    setSelectedLessonId("");
    setNewLessonTitle("");
    setLessonContent("");
  };

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wizard/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (newConversation: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations"] });
      setSelectedConversationId(newConversation.id);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/wizard/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations"] });
      if (conversations.length > 1) {
        const remaining = conversations.filter(c => c.id !== selectedConversationId);
        setSelectedConversationId(remaining[0]?.id || null);
      } else {
        setSelectedConversationId(null);
      }
    },
  });

  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedConversationId || isStreaming) return;

    const messageContent = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`/api/wizard/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              setStreamingMessage(prev => prev + event.content);
            }
            if (event.done) {
              queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations", selectedConversationId] });
            }
          } catch {
          }
        }
      }
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, streamingMessage]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const messages = currentConversation?.messages || [];

  // Handle text selection in assistant messages
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
      setSelectedText("");
      setSelectionPos(null);
      return;
    }
    
    // Check if selection is within an assistant message
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const assistantMessage = (commonAncestor.nodeType === Node.TEXT_NODE 
      ? commonAncestor.parentElement 
      : commonAncestor as Element)?.closest('[data-assistant-message]');
    
    if (!assistantMessage) {
      return;
    }
    
    const text = selection.toString().trim();
    if (text.length > 0) {
      const rect = range.getBoundingClientRect();
      const container = messagesContainerRef.current;
      const containerRect = container?.getBoundingClientRect();
      
      if (containerRect && container) {
        setSelectedText(text);
        setSelectionPos({
          top: rect.bottom - containerRect.top + 8,
          left: rect.left - containerRect.left + rect.width / 2,
        });
      }
    }
  }, []);

  // Set up selection listener
  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelection);
    document.addEventListener("keyup", handleTextSelection);
    
    return () => {
      document.removeEventListener("mouseup", handleTextSelection);
      document.removeEventListener("keyup", handleTextSelection);
    };
  }, [handleTextSelection]);

  const handleAddToLesson = () => {
    setLessonContent(selectedText);
    setShowAddToLessonDialog(true);
    // Clear the floating button
    setSelectionPos(null);
  };

  const handleSaveLesson = () => {
    // Validate content is not empty
    if (!lessonContent.trim()) {
      toast({
        title: "Missing Content",
        description: "Please enter or select some text to add to the lesson.",
        variant: "destructive",
      });
      return;
    }
    
    if (lessonMode === "new") {
      if (!selectedSubjectId || !newLessonTitle.trim()) {
        toast({
          title: "Missing Information",
          description: "Please select a student, subject, and enter a lesson title.",
          variant: "destructive",
        });
        return;
      }
      createLessonMutation.mutate({
        title: newLessonTitle.trim(),
        content: lessonContent.trim(),
        subjectId: parseInt(selectedSubjectId),
      });
    } else {
      if (!selectedLessonId) {
        toast({
          title: "Missing Information",
          description: "Please select a lesson to add the text to.",
          variant: "destructive",
        });
        return;
      }
      
      updateLessonMutation.mutate({
        lessonId: parseInt(selectedLessonId),
        newContent: lessonContent.trim(),
      });
    }
  };

  const formatMessage = (content: string) => {
    const parts = content.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-4">
        <Card className="w-64 flex-shrink-0 flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversations</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {conversationsLoading ? (
              <div className="p-2 space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => createConversationMutation.mutate()}
                  data-testid="button-start-first-conversation"
                >
                  Start a chat
                </Button>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                      selectedConversationId === conv.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedConversationId(conv.id)}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{conv.title}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                        selectedConversationId === conv.id && "hover:bg-primary-foreground/20"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-conversation-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Homeschool Wizard</h1>
              <p className="text-xs text-muted-foreground">
                Charlotte Mason guide with free resource recommendations
              </p>
            </div>
          </div>

          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 relative">
            {/* Floating selection button */}
            {selectionPos && selectedText && (
              <div
                className="absolute z-50 transform -translate-x-1/2"
                style={{ top: selectionPos.top, left: selectionPos.left }}
              >
                <Button
                  onClick={handleAddToLesson}
                  className="shadow-lg"
                  data-testid="button-add-to-lesson"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Lesson
                </Button>
              </div>
            )}
            
            {!selectedConversationId ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-lg font-medium mb-2">Welcome to the Homeschool Wizard</h2>
                <p className="text-muted-foreground max-w-md mb-4">
                  I speak in the spirit of Charlotte Mason and can help you plan curriculum, 
                  find free resources, and guide your homeschool journey.
                </p>
                <Button
                  onClick={() => createConversationMutation.mutate()}
                  disabled={createConversationMutation.isPending}
                  data-testid="button-start-conversation"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start a Conversation
                </Button>
              </div>
            ) : messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                    <Skeleton className="h-16 w-3/4 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 && !streamingMessage ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Sparkles className="h-12 w-12 text-primary/30 mb-4" />
                <p className="text-muted-foreground">
                  Ask me about curriculum planning, lesson ideas, or free educational resources!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3 whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                      data-testid={`message-${msg.id}`}
                      data-assistant-message={msg.role === "assistant" ? "true" : undefined}
                    >
                      {formatMessage(msg.content)}
                    </div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted whitespace-pre-wrap" data-assistant-message="true">
                      {formatMessage(streamingMessage)}
                      <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {selectedConversationId && (
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about curriculum, lesson ideas, or resources..."
                  disabled={isStreaming}
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming}
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
      
      {/* Add to Lesson Dialog */}
      <Dialog open={showAddToLessonDialog} onOpenChange={(open) => !open && resetLessonDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Add to Lesson
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Selected Text</Label>
              <Textarea
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                className="mt-1.5 min-h-[100px]"
                placeholder="The selected text will appear here..."
                data-testid="textarea-lesson-content"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">What would you like to do?</Label>
              <RadioGroup
                value={lessonMode}
                onValueChange={(value) => setLessonMode(value as "new" | "existing")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="mode-new" data-testid="radio-mode-new" />
                  <Label htmlFor="mode-new" className="cursor-pointer">Create new lesson</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="mode-existing" data-testid="radio-mode-existing" />
                  <Label htmlFor="mode-existing" className="cursor-pointer">Add to existing lesson</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label htmlFor="student-select" className="text-sm font-medium">Student</Label>
              <Select 
                value={selectedStudentId} 
                onValueChange={(value) => {
                  setSelectedStudentId(value);
                  setSelectedSubjectId("");
                  setSelectedLessonId("");
                }}
              >
                <SelectTrigger id="student-select" className="mt-1.5" data-testid="select-student">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id.toString()} data-testid={`select-item-student-${student.id}`}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="subject-select" className="text-sm font-medium">Subject</Label>
              <Select 
                value={selectedSubjectId} 
                onValueChange={(value) => {
                  setSelectedSubjectId(value);
                  setSelectedLessonId("");
                }}
                disabled={!selectedStudentId}
              >
                <SelectTrigger id="subject-select" className="mt-1.5" data-testid="select-subject">
                  <SelectValue placeholder={selectedStudentId ? "Select a subject" : "Select a student first"} />
                </SelectTrigger>
                <SelectContent>
                  {studentSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id.toString()} data-testid={`select-item-subject-${subject.id}`}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {lessonMode === "new" ? (
              <div>
                <Label htmlFor="lesson-title" className="text-sm font-medium">Lesson Title</Label>
                <Input
                  id="lesson-title"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Enter a title for the new lesson"
                  className="mt-1.5"
                  data-testid="input-lesson-title"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="lesson-select" className="text-sm font-medium">Select Lesson</Label>
                <Select 
                  value={selectedLessonId} 
                  onValueChange={setSelectedLessonId}
                  disabled={!selectedSubjectId}
                >
                  <SelectTrigger id="lesson-select" className="mt-1.5" data-testid="select-lesson">
                    <SelectValue placeholder={selectedSubjectId ? "Select a lesson" : "Select a subject first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {lessons.map((lesson) => (
                      <SelectItem key={lesson.id} value={lesson.id.toString()} data-testid={`select-item-lesson-${lesson.id}`}>
                        {lesson.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={resetLessonDialog} data-testid="button-cancel-lesson">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveLesson}
              disabled={createLessonMutation.isPending || updateLessonMutation.isPending}
              data-testid="button-save-lesson"
            >
              {(createLessonMutation.isPending || updateLessonMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {lessonMode === "new" ? "Create Lesson" : "Add to Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
