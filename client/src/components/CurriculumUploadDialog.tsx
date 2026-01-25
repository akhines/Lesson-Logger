import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Image, Calendar as CalendarIcon, Loader2, Sparkles, Check, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParsedChapter {
  chapterNumber: number;
  title: string;
  description?: string;
  pageNumber?: number;
}

interface CurriculumParseResult {
  chapters: ParsedChapter[];
  curriculumName?: string;
  gradeLevel?: string;
  totalChapters: number;
}

interface CurriculumUploadDialogProps {
  subjectId: number;
  subjectName: string;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function CurriculumUploadDialog({ subjectId, subjectName, trigger, externalOpen, onExternalOpenChange }: CurriculumUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onExternalOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [activeTab, setActiveTab] = useState<"text" | "image" | "pdf">("text");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedResult, setParsedResult] = useState<CurriculumParseResult | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [step, setStep] = useState<"upload" | "review" | "schedule">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseMutation = useMutation({
    mutationFn: async ({ content, contentType, mimeType }: { content: string; contentType: string; mimeType?: string }) => {
      const res = await apiRequest("POST", "/api/curriculum/parse", { content, contentType, mimeType });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to parse curriculum" }));
        throw new Error(errorData.message || "Failed to parse curriculum");
      }
      return res.json() as Promise<CurriculumParseResult>;
    },
    onSuccess: (data) => {
      setParsedResult(data);
      setSelectedChapters(new Set(data.chapters.map((_, i) => i)));
      setStep("review");
    },
    onError: (error: Error) => {
      toast({ title: "Parsing failed", description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ chapters, startDate }: { chapters: ParsedChapter[]; startDate: string }) => {
      const res = await apiRequest("POST", "/api/curriculum/generate-lessons", {
        subjectId,
        chapters,
        startDate,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to generate lessons" }));
        throw new Error(errorData.message || "Failed to generate lessons");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Created ${data.lessonsCreated} lessons` });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      resetDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const resetDialog = () => {
    setOpen(false);
    setStep("upload");
    setTextContent("");
    setSelectedFile(null);
    setParsedResult(null);
    setSelectedChapters(new Set());
    setStartDate(new Date());
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleParse = async () => {
    if (activeTab === "text") {
      if (!textContent.trim()) {
        toast({ title: "Please enter text content", variant: "destructive" });
        return;
      }
      parseMutation.mutate({ content: textContent, contentType: "text" });
    } else if (selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const contentType = activeTab === "pdf" ? "pdf" : "image";
        parseMutation.mutate({ content: base64, contentType, mimeType: selectedFile.type });
      };
      reader.readAsDataURL(selectedFile);
    } else {
      toast({ title: "Please select a file", variant: "destructive" });
    }
  };

  const handleGenerate = () => {
    if (!parsedResult || !startDate) return;
    const chapters = parsedResult.chapters.filter((_, i) => selectedChapters.has(i));
    if (chapters.length === 0) {
      toast({ title: "Please select at least one chapter", variant: "destructive" });
      return;
    }
    // Format as YYYY-MM-DD (no time component)
    const dateStr = format(startDate, "yyyy-MM-dd");
    generateMutation.mutate({ chapters, startDate: dateStr });
  };

  const toggleChapter = (index: number) => {
    const newSet = new Set(selectedChapters);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedChapters(newSet);
  };

  const selectAll = () => {
    if (parsedResult) {
      setSelectedChapters(new Set(parsedResult.chapters.map((_, i) => i)));
    }
  };

  const deselectAll = () => {
    setSelectedChapters(new Set());
  };

  const isParsing = parseMutation.isPending;
  const isGenerating = generateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2" data-testid="button-curriculum-upload">
            <Sparkles className="h-4 w-4" />
            AI Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import Curriculum for {subjectName}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a table of contents image, PDF, or paste text to automatically generate lessons.
            </p>
            
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="text" className="gap-2" data-testid="tab-text">
                  <FileText className="h-4 w-4" /> Text
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2" data-testid="tab-image">
                  <Image className="h-4 w-4" /> Image
                </TabsTrigger>
                <TabsTrigger value="pdf" className="gap-2" data-testid="tab-pdf">
                  <Upload className="h-4 w-4" /> PDF
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3">
                <Label>Paste your table of contents or chapter list</Label>
                <Textarea
                  placeholder="Chapter 1: Introduction&#10;Chapter 2: Getting Started&#10;Chapter 3: Basic Concepts&#10;..."
                  className="min-h-[200px] resize-none"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  data-testid="textarea-curriculum-text"
                />
              </TabsContent>

              <TabsContent value="image" className="space-y-3">
                <Label>Upload an image of your table of contents</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-image"
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Check className="h-8 w-8 text-green-500" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Image className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">Click to upload image</p>
                      <p className="text-sm text-muted-foreground">JPG, PNG, or WEBP</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="space-y-3">
                <Label>Upload a PDF of your curriculum</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-pdf"
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <Check className="h-8 w-8 text-green-500" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">Click to upload PDF</p>
                      <p className="text-sm text-muted-foreground">PDF files only</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === "review" && parsedResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Found {parsedResult.totalChapters} chapters
                  {parsedResult.curriculumName && ` in "${parsedResult.curriculumName}"`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedChapters.size} selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Clear
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-lg p-3">
              <div className="space-y-2">
                {parsedResult.chapters.map((chapter, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors",
                      selectedChapters.has(index) ? "bg-primary/10" : "hover:bg-muted"
                    )}
                    onClick={() => toggleChapter(index)}
                    data-testid={`checkbox-chapter-${index}`}
                  >
                    <Checkbox
                      checked={selectedChapters.has(index)}
                      onCheckedChange={() => toggleChapter(index)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {chapter.chapterNumber}. {chapter.title}
                      </p>
                      {chapter.description && (
                        <p className="text-xs text-muted-foreground">{chapter.description}</p>
                      )}
                    </div>
                    {chapter.pageNumber && (
                      <span className="text-xs text-muted-foreground">p. {chapter.pageNumber}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === "schedule" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose when to start scheduling {selectedChapters.size} lessons.
            </p>
            
            <div className="flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-select-date">
                    <CalendarIcon className="h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Lessons will be scheduled on the subject's school days starting from this date.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={isParsing} data-testid="button-parse">
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse Content
                  </>
                )}
              </Button>
            </>
          )}

          {step === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button 
                onClick={() => setStep("schedule")} 
                disabled={selectedChapters.size === 0}
                data-testid="button-continue-schedule"
              >
                Continue ({selectedChapters.size} selected)
              </Button>
            </>
          )}

          {step === "schedule" && (
            <>
              <Button variant="ghost" onClick={() => setStep("review")}>
                Back
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || !startDate} data-testid="button-generate">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create {selectedChapters.size} Lessons
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
