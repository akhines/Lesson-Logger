import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Save, ChevronLeft, ChevronRight, Plus, Trash2, ZoomIn, ZoomOut, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface TextAnnotation {
  id?: number;
  clientId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
}

interface PDFWorksheetProps {
  lessonId: number;
  pdfUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFWorksheet({ lessonId, pdfUrl, open, onOpenChange }: PDFWorksheetProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const { data: savedAnnotations, isLoading: isLoadingAnnotations } = useQuery<TextAnnotation[]>({
    queryKey: ["/api/student-portal/pdf-annotations", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/student-portal/pdf-annotations/${lessonId}`);
      if (!res.ok) throw new Error("Failed to load annotations");
      return res.json();
    },
    enabled: open && !!lessonId,
  });

  const saveMutation = useMutation({
    mutationFn: async (annots: TextAnnotation[]) => {
      const res = await fetch(`/api/student-portal/pdf-annotations/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: annots }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-portal/pdf-annotations", lessonId] });
      toast({ title: "Saved!", description: "Your work has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save your work.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (savedAnnotations) {
      setAnnotations(savedAnnotations.map(a => ({
        ...a,
        clientId: a.clientId || `saved-${a.id || Math.random().toString(36).slice(2)}`,
      })));
    }
  }, [savedAnnotations]);
  
  const generateClientId = () => `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const loadPdf = useCallback(async () => {
    if (!pdfUrl || !open) return;
    
    setIsLoading(true);
    try {
      // Use proxy for external URLs to avoid CORS issues
      const urlToLoad = pdfUrl.startsWith('http') 
        ? `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`
        : pdfUrl;
      
      const loadingTask = pdfjsLib.getDocument(urlToLoad);
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [pdfUrl, open, toast]);

  useEffect(() => {
    if (open) {
      loadPdf();
    }
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
        setPdfDoc(null);
      }
    };
  }, [open, loadPdf]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setPageSize({ width: viewport.width, height: viewport.height });
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || pageSize.width === 0 || pageSize.height === 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const clientId = generateClientId();
    const newAnnotation: TextAnnotation = {
      clientId,
      pageNumber: currentPage,
      x: Math.max(0, Math.min(95, x)),
      y: Math.max(0, Math.min(95, y)),
      width: 30,
      height: 8,
      text: "",
      fontSize: 14,
    };
    
    setAnnotations([...annotations, newAnnotation]);
    setActiveAnnotationId(clientId);
  };

  const updateAnnotation = (clientId: string, updates: Partial<TextAnnotation>) => {
    setAnnotations(prev => prev.map(a => a.clientId === clientId ? { ...a, ...updates } : a));
  };

  const deleteAnnotation = (clientId: string) => {
    setAnnotations(prev => prev.filter(a => a.clientId !== clientId));
    setActiveAnnotationId(null);
  };

  const handleSave = () => {
    saveMutation.mutate(annotations);
  };

  const pageAnnotations = annotations.filter(a => a.pageNumber === currentPage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Interactive Worksheet
          </DialogTitle>
          <DialogDescription className="text-sm">
            Click anywhere on the PDF to add a text box. Type your answers directly on the worksheet.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[80px] text-center">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale(s => Math.min(2, s + 0.2))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-annotations"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Work
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 bg-muted/20">
          {isLoading || isLoadingAnnotations ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                ref={containerRef}
                className="relative cursor-crosshair shadow-lg"
                style={{ width: pageSize.width || "auto", height: pageSize.height || "auto" }}
                onClick={handleCanvasClick}
              >
                <canvas ref={canvasRef} className="block pointer-events-none" />
                
                {pageAnnotations.map((annotation) => (
                    <div
                      key={annotation.clientId}
                      className={`absolute group ${activeAnnotationId === annotation.clientId ? "ring-2 ring-primary" : ""}`}
                      style={{
                        left: `${annotation.x}%`,
                        top: `${annotation.y}%`,
                        width: `${annotation.width}%`,
                        minHeight: `${annotation.height}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveAnnotationId(annotation.clientId);
                      }}
                    >
                      <textarea
                        value={annotation.text}
                        onChange={(e) => updateAnnotation(annotation.clientId, { text: e.target.value })}
                        className="w-full h-full min-h-[32px] bg-yellow-100/90 border border-yellow-400 rounded p-1 text-sm resize focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ fontSize: annotation.fontSize || 14 }}
                        placeholder="Type here..."
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`annotation-${annotation.clientId}`}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAnnotation(annotation.clientId);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-delete-annotation-${annotation.clientId}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-3 border-t bg-muted/30 text-sm text-muted-foreground text-center shrink-0">
          Click on the worksheet to add a text box. Your work saves automatically.
        </div>
      </DialogContent>
    </Dialog>
  );
}
