import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, List, Loader2, Check, BookMarked, Sun, Moon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ReadingProgress, Student } from "@shared/schema";

type Chapter = {
  title: string;
  startIndex: number;
  endIndex: number;
  content: string;
};

export default function StudentBookReader() {
  const [, navigate] = useLocation();
  const [bookId, setBookId] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const title = params.get("title");
    const author = params.get("author");
    if (id) setBookId(parseInt(id));
    if (title) setBookTitle(decodeURIComponent(title));
    if (author) setBookAuthor(decodeURIComponent(author));
  }, []);

  // Get current student
  const { data: student } = useQuery<Student>({
    queryKey: ["/api/student-portal/current-student"],
  });

  // Get existing reading progress
  const { data: existingProgress } = useQuery<ReadingProgress | null>({
    queryKey: ["/api/student-portal/reading-progress", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/student-portal/reading-progress/${bookId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!bookId,
  });

  // Fetch book content
  const { data: bookContent, isLoading: contentLoading } = useQuery<{ content: string; format: string }>({
    queryKey: ["/api/student-portal/gutenberg-content", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/student-portal/gutenberg-content/${bookId}`);
      if (!res.ok) throw new Error("Failed to fetch book content");
      return res.json();
    },
    enabled: !!bookId,
  });

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (data: Partial<ReadingProgress>) => {
      return await apiRequest("POST", "/api/student-portal/reading-progress", {
        gutenbergId: bookId,
        bookTitle,
        bookAuthor,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/reading-progress"] });
    },
  });

  // Parse chapters from book content
  useEffect(() => {
    if (!bookContent?.content) return;

    const text = bookContent.content;
    const parsedChapters: Chapter[] = [];
    
    // Common chapter patterns in Gutenberg books
    const chapterPatterns = [
      /^(CHAPTER\s+[IVXLCDM\d]+\.?[^\n]*)/gim,
      /^(Chapter\s+[IVXLCDM\d]+\.?[^\n]*)/gim,
      /^(PART\s+[IVXLCDM\d]+\.?[^\n]*)/gim,
      /^(\d+\.?\s+[A-Z][^\n]{5,50})/gm,
    ];

    let matches: { title: string; index: number }[] = [];
    
    for (const pattern of chapterPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({ title: match[1].trim(), index: match.index });
      }
      if (matches.length > 2) break; // Found enough chapters
    }

    // Sort by position
    matches.sort((a, b) => a.index - b.index);

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
        parsedChapters.push({
          title: matches[i].title,
          startIndex: start,
          endIndex: end,
          content: text.slice(start, end),
        });
      }
    } else {
      // No chapters found, split by large sections
      const paragraphs = text.split(/\n{3,}/);
      const chunkSize = Math.ceil(paragraphs.length / 10);
      for (let i = 0; i < paragraphs.length; i += chunkSize) {
        const chunk = paragraphs.slice(i, i + chunkSize).join("\n\n");
        parsedChapters.push({
          title: `Section ${Math.floor(i / chunkSize) + 1}`,
          startIndex: i,
          endIndex: i + chunkSize,
          content: chunk,
        });
      }
    }

    setChapters(parsedChapters);

    // Restore reading progress
    if (existingProgress) {
      setCurrentChapter(existingProgress.currentChapter || 0);
      setScrollPosition(existingProgress.scrollPosition || 0);
    }
  }, [bookContent, existingProgress]);

  // Apply scroll position when chapter changes or scroll position is restored
  useEffect(() => {
    if (contentRef.current && scrollPosition > 0 && chapters.length > 0) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        if (contentRef.current) {
          const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
          const targetScroll = (scrollPosition / 100) * maxScroll;
          contentRef.current.scrollTop = targetScroll;
          setScrollPosition(0); // Reset so it doesn't re-apply
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentChapter, chapters, scrollPosition]);

  // Save progress on scroll (debounced)
  const handleScroll = useCallback(() => {
    if (!contentRef.current || !bookId) return;

    const element = contentRef.current;
    const maxScroll = element.scrollHeight - element.clientHeight;
    const currentScroll = maxScroll > 0 ? Math.round((element.scrollTop / maxScroll) * 100) : 0;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = setTimeout(() => {
      saveProgressMutation.mutate({
        currentChapter,
        chapterCount: chapters.length,
        scrollPosition: currentScroll,
        isComplete: currentChapter === chapters.length - 1 && currentScroll > 90,
      });
    }, 2000);
  }, [bookId, currentChapter, chapters.length, saveProgressMutation]);

  const goToChapter = (index: number) => {
    setCurrentChapter(index);
    setShowChapterList(false);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    // Save progress
    saveProgressMutation.mutate({
      currentChapter: index,
      chapterCount: chapters.length,
      scrollPosition: 0,
    });
  };

  const nextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      goToChapter(currentChapter + 1);
    }
  };

  const prevChapter = () => {
    if (currentChapter > 0) {
      goToChapter(currentChapter - 1);
    }
  };

  if (!bookId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">No Book Selected</h2>
            <p className="text-muted-foreground mb-4">Please select a book from the library to start reading.</p>
            <Link href="/student-library">
              <Button data-testid="button-back-library">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Library
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-zinc-900 text-zinc-100' : 'bg-amber-50 text-zinc-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 px-4 py-2 flex items-center justify-between gap-2 border-b ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-amber-200'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/student-library">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-medium truncate" data-testid="text-book-title">{bookTitle}</h1>
            {bookAuthor && (
              <p className="text-xs text-muted-foreground truncate" data-testid="text-book-author">{bookAuthor}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Chapter list */}
          <Sheet open={showChapterList} onOpenChange={setShowChapterList}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-chapter-list">
                <List className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <BookMarked className="h-5 w-5" />
                  Chapters
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                <div className="space-y-1 pr-4">
                  {chapters.map((chapter, index) => (
                    <button
                      key={index}
                      onClick={() => goToChapter(index)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        index === currentChapter
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`button-chapter-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        {index < currentChapter && (
                          <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                        )}
                        <span className="truncate">{chapter.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Font size */}
          <div className="hidden sm:flex items-center gap-2 px-2">
            <span className="text-xs">A</span>
            <Slider
              value={[fontSize]}
              onValueChange={([v]) => setFontSize(v)}
              min={14}
              max={24}
              step={1}
              className="w-20"
              data-testid="slider-font-size"
            />
            <span className="text-base">A</span>
          </div>

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            data-testid="button-toggle-dark"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Progress bar */}
      <div className={`h-1 ${isDarkMode ? 'bg-zinc-700' : 'bg-amber-200'}`}>
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${chapters.length > 0 ? ((currentChapter + 1) / chapters.length) * 100 : 0}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {contentLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading book...</p>
            </div>
          </div>
        ) : chapters.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Unable to load book content</p>
            </div>
          </div>
        ) : (
          <div 
            ref={contentRef}
            className="h-full overflow-y-auto"
            onScroll={handleScroll}
          >
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
              {/* Chapter header */}
              <div className="mb-6 text-center">
                <Badge variant="outline" className="mb-2">
                  {currentChapter + 1} of {chapters.length}
                </Badge>
                <h2 className={`text-xl font-serif font-bold ${isDarkMode ? 'text-amber-100' : 'text-amber-900'}`} data-testid="text-chapter-title">
                  {chapters[currentChapter]?.title}
                </h2>
              </div>

              {/* Chapter content */}
              <div 
                className={`prose prose-lg max-w-none font-serif leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'prose-invert' : ''}`}
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
                data-testid="text-chapter-content"
              >
                {chapters[currentChapter]?.content}
              </div>

              {/* Chapter navigation */}
              <div className="flex items-center justify-between mt-12 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={prevChapter}
                  disabled={currentChapter === 0}
                  data-testid="button-prev-chapter"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <span className="text-sm text-muted-foreground">
                  {currentChapter + 1} / {chapters.length}
                </span>

                <Button
                  variant="outline"
                  onClick={nextChapter}
                  disabled={currentChapter === chapters.length - 1}
                  data-testid="button-next-chapter"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Completion message */}
              {currentChapter === chapters.length - 1 && (
                <Card className="mt-8 text-center bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <CardContent className="py-6">
                    <Check className="h-10 w-10 mx-auto text-green-600 mb-2" />
                    <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                      You've reached the end!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Great job finishing this book!
                    </p>
                    <Link href="/student-library">
                      <Button variant="outline" className="mt-4" data-testid="button-finish-back">
                        <BookMarked className="h-4 w-4 mr-2" />
                        Back to Library
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
