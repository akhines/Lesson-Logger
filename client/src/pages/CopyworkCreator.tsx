import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Download, PenTool, Trash2, Plus, Eye, CalendarIcon, BookOpen } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, addDays, startOfWeek, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import sunwovenLogo from "@assets/sunwoven_logo_only_1769369286959.png";
import type { Student, Subject } from "@shared/schema";

type SplitMode = "sentences" | "words" | "days";
type LineStyle = "handwriting" | "blank";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface CopyworkAssignment {
  id: number;
  text: string;
  wordCount: number;
  sentenceCount: number;
  dayOfWeek?: string;
}

export default function CopyworkCreator() {
  const { toast } = useToast();
  const [sourceText, setSourceText] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("sentences");
  const [splitValue, setSplitValue] = useState(2);
  const [lineStyle, setLineStyle] = useState<LineStyle>("handwriting");
  const [linesPerAssignment, setLinesPerAssignment] = useState(4);
  const [title, setTitle] = useState("Copywork");
  const [assignments, setAssignments] = useState<CopyworkAssignment[]>([]);
  
  // Student and lesson creation state
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Queries for students and subjects
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });
  
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
  
  // Filter subjects for selected student (Language Arts category)
  const studentSubjects = useMemo(() => {
    if (!selectedStudentId) return [];
    return subjects.filter(
      s => s.studentId === parseInt(selectedStudentId) && 
           (s.category === "language_arts" || s.name.toLowerCase().includes("language") || s.name.toLowerCase().includes("copywork"))
    );
  }, [subjects, selectedStudentId]);
  
  // Create lessons mutation
  const createLessonsMutation = useMutation({
    mutationFn: async (data: { subjectId: number; lessons: Array<{ title: string; content: string; dateScheduled: string }> }) => {
      const results = [];
      for (const lesson of data.lessons) {
        const result = await apiRequest("POST", "/api/lessons", {
          ...lesson,
          subjectId: data.subjectId,
          completed: false,
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      toast({
        title: "Lessons Created",
        description: `${assignments.length} copywork lessons have been added to the student's calendar.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lessons",
        variant: "destructive",
      });
    },
  });

  const splitTextIntoSentences = (text: string): string[] => {
    return text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const countWords = (text: string): number => {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  };

  const countSentences = (text: string): number => {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  };

  const parseText = () => {
    if (!sourceText.trim()) return;

    const newAssignments: CopyworkAssignment[] = [];
    
    if (splitMode === "days") {
      const sentences = splitTextIntoSentences(sourceText);
      const numDays = 5;
      const sentencesPerDay = Math.ceil(sentences.length / numDays);
      
      for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
        const startIdx = dayIndex * sentencesPerDay;
        const endIdx = Math.min(startIdx + sentencesPerDay, sentences.length);
        const daySentences = sentences.slice(startIdx, endIdx);
        
        if (daySentences.length > 0) {
          const text = daySentences.join(" ");
          newAssignments.push({
            id: dayIndex + 1,
            text,
            wordCount: countWords(text),
            sentenceCount: daySentences.length,
            dayOfWeek: DAY_NAMES[dayIndex],
          });
        }
      }
    } else if (splitMode === "sentences") {
      const sentences = splitTextIntoSentences(sourceText);
      let currentChunk: string[] = [];
      let assignmentId = 1;
      
      sentences.forEach((sentence) => {
        currentChunk.push(sentence);
        if (currentChunk.length >= splitValue) {
          const text = currentChunk.join(" ");
          newAssignments.push({
            id: assignmentId++,
            text,
            wordCount: countWords(text),
            sentenceCount: currentChunk.length,
          });
          currentChunk = [];
        }
      });
      
      if (currentChunk.length > 0) {
        const text = currentChunk.join(" ");
        newAssignments.push({
          id: assignmentId,
          text,
          wordCount: countWords(text),
          sentenceCount: currentChunk.length,
        });
      }
    } else {
      const words = sourceText.split(/\s+/).filter(w => w.length > 0);
      let currentChunk: string[] = [];
      let assignmentId = 1;
      
      words.forEach((word) => {
        currentChunk.push(word);
        if (currentChunk.length >= splitValue) {
          const text = currentChunk.join(" ");
          newAssignments.push({
            id: assignmentId++,
            text,
            wordCount: currentChunk.length,
            sentenceCount: countSentences(text),
          });
          currentChunk = [];
        }
      });
      
      if (currentChunk.length > 0) {
        const text = currentChunk.join(" ");
        newAssignments.push({
          id: assignmentId,
          text,
          wordCount: currentChunk.length,
          sentenceCount: countSentences(text),
        });
      }
    }
    
    setAssignments(newAssignments);
  };

  // Create lessons for selected student based on assignments
  const createLessonsForStudent = () => {
    if (!selectedSubjectId || assignments.length === 0) return;
    
    // Map day names to day offsets from Monday
    const dayOffsets: Record<string, number> = {
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
    };
    
    const lessons = assignments.map((assignment, index) => {
      // Calculate the date for this lesson
      let lessonDate: Date;
      if (assignment.dayOfWeek && dayOffsets[assignment.dayOfWeek] !== undefined) {
        lessonDate = addDays(weekStartDate, dayOffsets[assignment.dayOfWeek]);
      } else {
        // For non-day mode, schedule sequentially starting from Monday
        lessonDate = addDays(weekStartDate, index);
      }
      
      return {
        title: `${title} - ${assignment.dayOfWeek || `Day ${index + 1}`}`,
        content: assignment.text,
        dateScheduled: format(lessonDate, "yyyy-MM-dd"),
      };
    });
    
    createLessonsMutation.mutate({
      subjectId: parseInt(selectedSubjectId),
      lessons,
    });
  };

  const removeAssignment = (id: number) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const updateAssignmentText = (id: number, newText: string) => {
    setAssignments(prev => prev.map(a => 
      a.id === id 
        ? { ...a, text: newText, wordCount: countWords(newText), sentenceCount: countSentences(newText) }
        : a
    ));
  };

  const generatePDF = async () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const usableWidth = pageWidth - (margin * 2);
    const lineHeight = lineStyle === "handwriting" ? 12 : 10;
    const textLineHeight = 6;

    // Load the logo image
    const loadImage = (src: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = src;
      });
    };

    let logoDataUrl: string | null = null;
    try {
      logoDataUrl = await loadImage(sunwovenLogo);
    } catch (e) {
      console.error("Could not load logo:", e);
    }

    assignments.forEach((assignment, index) => {
      if (index > 0) {
        doc.addPage();
      }

      let yPos = margin;

      // Add logo to top left
      if (logoDataUrl) {
        const logoSize = 20;
        doc.addImage(logoDataUrl, "PNG", margin, yPos - 5, logoSize, logoSize);
      }

      // Title next to logo
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const titleX = logoDataUrl ? margin + 25 : margin;
      const dayLabel = assignment.dayOfWeek || `Day ${index + 1}`;
      doc.text(`${title} - ${dayLabel}`, titleX, yPos + 5);
      
      // Name and Date lines on the right side
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const rightSection = pageWidth - margin - 60;
      doc.text("Name: ____________________", rightSection, yPos);
      doc.text("Date: ____________________", rightSection, yPos + 6);
      
      yPos += 25;

      // Directions
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80);
      doc.text("Directions: Using your best handwriting, copy each word and be sure to focus on", margin, yPos);
      yPos += 5;
      doc.text("capitalization, spelling, and punctuation.", margin, yPos);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      yPos += 10;

      // The text to copy
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      const textLines = doc.splitTextToSize(assignment.text, usableWidth);
      textLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += textLineHeight;
      });

      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Copy the text above on the lines below:", margin, yPos);
      doc.setTextColor(0);
      yPos += 8;

      const drawLine = (y: number) => {
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
      };

      // Calculate how many lines can fit in remaining page space
      const bottomMargin = margin + 10; // Leave space for page number
      const remainingSpace = pageHeight - yPos - bottomMargin;
      const maxLines = Math.floor(remainingSpace / lineHeight);

      if (lineStyle === "handwriting") {
        for (let i = 0; i < maxLines; i++) {
          const baseY = yPos + (i * lineHeight);
          
          doc.setDrawColor(200, 200, 255);
          doc.setLineWidth(0.2);
          doc.line(margin, baseY + 4, pageWidth - margin, baseY + 4);
          
          doc.setDrawColor(255, 200, 200);
          doc.setLineWidth(0.2);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(margin, baseY + 7, pageWidth - margin, baseY + 7);
          doc.setLineDashPattern([], 0);
          
          doc.setDrawColor(100);
          doc.setLineWidth(0.4);
          doc.line(margin, baseY + 10, pageWidth - margin, baseY + 10);
        }
      } else {
        for (let i = 0; i < maxLines; i++) {
          const lineY = yPos + (i * lineHeight);
          drawLine(lineY);
        }
      }

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${index + 1} of ${assignments.length}`, pageWidth - margin - 30, pageHeight - 10);
      doc.setTextColor(0);
    });

    doc.save(`${title.replace(/\s+/g, "_")}_copywork.pdf`);
  };

  const stats = useMemo(() => {
    const totalWords = countWords(sourceText);
    const totalSentences = splitTextIntoSentences(sourceText).length;
    return { totalWords, totalSentences };
  }, [sourceText]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Copywork Creator</h1>
          <p className="text-muted-foreground mt-1">
            Create beautiful copywork assignments from any text
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Source Text
                </CardTitle>
                <CardDescription>
                  Paste the text you want to create copywork from
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your text here... Poetry, scripture, famous quotes, or any passage you'd like students to copy."
                  className="min-h-[200px] resize-none"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  data-testid="input-source-text"
                />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{stats.totalWords} words</span>
                  <span>{stats.totalSentences} sentences</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="h-5 w-5" />
                  Split Settings
                </CardTitle>
                <CardDescription>
                  Configure how the text is divided into assignments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Assignment Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Week 1 Copywork"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Split By</Label>
                  <Select value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
                    <SelectTrigger data-testid="select-split-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days of Week (Mon-Fri)</SelectItem>
                      <SelectItem value="sentences">Sentences</SelectItem>
                      <SelectItem value="words">Words</SelectItem>
                    </SelectContent>
                  </Select>
                  {splitMode === "days" && (
                    <p className="text-xs text-muted-foreground">
                      Text will be split by sentences and distributed evenly across Monday through Friday.
                    </p>
                  )}
                </div>

                {splitMode !== "days" && (
                  <div className="space-y-3">
                    <Label>
                      {splitMode === "sentences" 
                        ? "Sentences per Assignment" 
                        : "Words per Assignment"
                      }
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={splitValue}
                      onChange={(e) => setSplitValue(parseInt(e.target.value) || 1)}
                      data-testid="input-split-value"
                    />
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <Label>Writing Lines Style</Label>
                  <RadioGroup 
                    value={lineStyle} 
                    onValueChange={(v) => setLineStyle(v as LineStyle)}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="handwriting" id="handwriting" data-testid="radio-handwriting" />
                      <Label htmlFor="handwriting" className="font-normal cursor-pointer">
                        Handwriting guides (top, middle, baseline)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="blank" id="blank" data-testid="radio-blank" />
                      <Label htmlFor="blank" className="font-normal cursor-pointer">
                        Simple blank lines
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Lines per Assignment</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={linesPerAssignment}
                    onChange={(e) => setLinesPerAssignment(parseInt(e.target.value) || 4)}
                    data-testid="input-lines-per-assignment"
                  />
                </div>

                <Button 
                  onClick={parseText} 
                  className="w-full"
                  disabled={!sourceText.trim()}
                  data-testid="button-parse-text"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Parse Text into Assignments
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Preview
                    {assignments.length > 0 && (
                      <Badge variant="secondary">{assignments.length} assignments</Badge>
                    )}
                  </span>
                  {assignments.length > 0 && (
                    <Button onClick={generatePDF} data-testid="button-generate-pdf">
                      <Download className="h-4 w-4 mr-2" />
                      Generate PDF
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Review and edit your copywork assignments before generating
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Paste text and click "Parse Text" to see assignments</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {assignments.map((assignment, index) => (
                      <Card key={assignment.id} className="bg-muted/30">
                        <CardHeader className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {assignment.dayOfWeek || `Day ${index + 1}`}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {assignment.wordCount} words
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAssignment(assignment.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              data-testid={`button-remove-assignment-${assignment.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                          <Textarea
                            value={assignment.text}
                            onChange={(e) => updateAssignmentText(assignment.id, e.target.value)}
                            className="min-h-[80px] text-sm resize-none"
                            data-testid={`textarea-assignment-${assignment.id}`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {assignments.length > 0 && (
              <>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-medium">Ready to print!</p>
                        <p className="text-sm text-muted-foreground">
                          {assignments.length} copywork pages with {lineStyle === "handwriting" ? "handwriting guides" : "blank lines"}
                        </p>
                      </div>
                      <Button onClick={generatePDF} size="lg" data-testid="button-download-pdf">
                        <Download className="h-5 w-5 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Add to Student Calendar */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Add to Student Calendar
                    </CardTitle>
                    <CardDescription>
                      Assign this copywork to a student and add it to their lesson calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Select Student</Label>
                        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                          <SelectTrigger data-testid="select-student">
                            <SelectValue placeholder="Choose a student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id.toString()}>
                                {student.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Language Arts Subject</Label>
                        <Select 
                          value={selectedSubjectId} 
                          onValueChange={setSelectedSubjectId}
                          disabled={!selectedStudentId || studentSubjects.length === 0}
                        >
                          <SelectTrigger data-testid="select-subject">
                            <SelectValue placeholder={
                              !selectedStudentId 
                                ? "Select a student first" 
                                : studentSubjects.length === 0 
                                  ? "No Language Arts subject found"
                                  : "Choose a subject"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {studentSubjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.id.toString()}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedStudentId && studentSubjects.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Create a Language Arts subject for this student first.
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Week Starting</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !weekStartDate && "text-muted-foreground"
                            )}
                            data-testid="button-week-start"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {weekStartDate ? format(weekStartDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={weekStartDate}
                            onSelect={(date) => date && setWeekStartDate(startOfWeek(date, { weekStartsOn: 1 }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Lessons will be scheduled for Mon-Fri of the selected week
                      </p>
                    </div>
                    
                    <Button
                      onClick={createLessonsForStudent}
                      disabled={!selectedSubjectId || createLessonsMutation.isPending}
                      className="w-full"
                      data-testid="button-add-to-calendar"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {createLessonsMutation.isPending ? "Creating Lessons..." : "Add to Student Calendar"}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
