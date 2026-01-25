import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Pencil, Eraser, Square, Circle, Download, Trash2, 
  Undo, Palette, Save, FolderOpen, Image
} from 'lucide-react';

interface Artwork {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: string;
}

interface StudentArtCanvasProps {
  studentId: number;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B00', '#FFD700', 
  '#00FF00', '#00CED1', '#0000FF', '#8B00FF', '#FF1493',
  '#8B4513', '#808080', '#FFC0CB', '#98FB98', '#87CEEB',
];

type Tool = 'pencil' | 'eraser' | 'rectangle' | 'circle' | 'fill';

export function StudentArtCanvas({ studentId }: StudentArtCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [, forceUpdate] = useState(0);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [title, setTitle] = useState('My Artwork');
  const [showGallery, setShowGallery] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [tempCanvas, setTempCanvas] = useState<ImageData | null>(null);

  const storageKey = `student_art_${studentId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setArtworks(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load artworks');
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    saveToHistory();
  }, []);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Truncate future history if we're not at the end
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(imageData);
    
    // Limit history to 50 items
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
    
    forceUpdate(n => n + 1);
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyIndexRef.current--;
    ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
    forceUpdate(n => n + 1);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    if (tool === 'rectangle' || tool === 'circle') {
      setTempCanvas(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } else if (tool === 'fill') {
      floodFill(coords.x, coords.y);
      saveToHistory();
      setIsDrawing(false);
    } else {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    if (tool === 'rectangle' || tool === 'circle') {
      if (tempCanvas && startPos) {
        ctx.putImageData(tempCanvas, 0, 0);
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;

        if (tool === 'rectangle') {
          ctx.strokeRect(
            startPos.x,
            startPos.y,
            coords.x - startPos.x,
            coords.y - startPos.y
          );
        } else {
          const radiusX = Math.abs(coords.x - startPos.x) / 2;
          const radiusY = Math.abs(coords.y - startPos.y) / 2;
          const centerX = startPos.x + (coords.x - startPos.x) / 2;
          const centerY = startPos.y + (coords.y - startPos.y) / 2;
          
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    } else {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setStartPos(null);
      setTempCanvas(null);
      saveToHistory();
    }
  };

  const floodFill = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const targetColor = getPixelColor(data, Math.floor(startX), Math.floor(startY), canvas.width);
    const fillColor = hexToRgb(color);

    if (!fillColor) return;
    if (colorsMatch(targetColor, fillColor)) return;

    const stack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

      const currentColor = getPixelColor(data, x, y, canvas.width);
      if (!colorsMatch(currentColor, targetColor)) continue;

      visited.add(key);
      setPixelColor(data, x, y, canvas.width, fillColor);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const getPixelColor = (data: Uint8ClampedArray, x: number, y: number, width: number) => {
    const idx = (y * width + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  };

  const setPixelColor = (
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    color: { r: number; g: number; b: number }
  ) => {
    const idx = (y * width + x) * 4;
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = 255;
  };

  const colorsMatch = (
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number },
    tolerance = 10
  ) => {
    return (
      Math.abs(c1.r - c2.r) <= tolerance &&
      Math.abs(c1.g - c2.g) <= tolerance &&
      Math.abs(c1.b - c2.b) <= tolerance
    );
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  const saveArtwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Use JPEG with lower quality for smaller file size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const newArtwork: Artwork = {
        id: Date.now().toString(),
        title,
        dataUrl,
        createdAt: new Date().toISOString(),
      };

      const updated = [newArtwork, ...artworks];
      
      // Try to save to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setArtworks(updated);
        setShowGallery(true); // Auto-open gallery after saving
        toast({
          title: "Artwork Saved!",
          description: `"${title}" has been saved to your gallery.`,
        });
      } catch (storageError) {
        // If localStorage is full, try to remove oldest artwork
        if (updated.length > 1) {
          const trimmed = updated.slice(0, 10); // Keep only last 10
          localStorage.setItem(storageKey, JSON.stringify(trimmed));
          setArtworks(trimmed);
          toast({
            title: "Artwork Saved!",
            description: "Some older artwork was removed to save space.",
          });
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      console.error('Failed to save artwork:', error);
      toast({
        title: "Save Failed",
        description: "Could not save artwork. Storage may be full.",
        variant: "destructive",
      });
    }
  };

  const loadArtwork = (artwork: Artwork) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      setTitle(artwork.title);
      saveToHistory();
      setShowGallery(false);
    };
    img.src = artwork.dataUrl;
  };

  const downloadArtwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${title || 'artwork'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const deleteArtwork = (id: string) => {
    const updated = artworks.filter(a => a.id !== id);
    setArtworks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <Card className="lg:w-48 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="icon"
              variant={tool === 'pencil' ? 'default' : 'outline'}
              onClick={() => setTool('pencil')}
              data-testid="tool-pencil"
              title="Pencil"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'eraser' ? 'default' : 'outline'}
              onClick={() => setTool('eraser')}
              data-testid="tool-eraser"
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'fill' ? 'default' : 'outline'}
              onClick={() => setTool('fill')}
              data-testid="tool-fill"
              title="Fill"
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'rectangle' ? 'default' : 'outline'}
              onClick={() => setTool('rectangle')}
              data-testid="tool-rectangle"
              title="Rectangle"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={tool === 'circle' ? 'default' : 'outline'}
              onClick={() => setTool('circle')}
              data-testid="tool-circle"
              title="Circle"
            >
              <Circle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={undo}
              disabled={historyIndexRef.current <= 0}
              data-testid="tool-undo"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Brush Size: {brushSize}</p>
            <Slider
              value={[brushSize]}
              onValueChange={(v) => setBrushSize(v[0])}
              min={1}
              max={50}
              step={1}
              data-testid="slider-brush-size"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Colors</p>
            <div className="grid grid-cols-5 gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded border-2 ${
                    color === c ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  data-testid={`color-${c.replace('#', '')}`}
                />
              ))}
            </div>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-8 p-1"
              data-testid="input-custom-color"
            />
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={clearCanvas}
              data-testid="button-clear-canvas"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button 
              className="w-full" 
              size="sm"
              onClick={saveArtwork}
              data-testid="button-save-artwork"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={() => setShowGallery(!showGallery)}
              data-testid="button-open-gallery"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Gallery
            </Button>
            <Button 
              className="w-full" 
              size="sm" 
              variant="outline"
              onClick={downloadArtwork}
              data-testid="button-download-artwork"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              <Input
                placeholder="Artwork title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
                data-testid="input-artwork-title"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                data-testid="art-canvas"
              />
            </div>
          </CardContent>
        </Card>

        {showGallery && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">My Gallery</CardTitle>
            </CardHeader>
            <CardContent>
              {artworks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved artworks yet. Create something amazing!</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {artworks.map((artwork) => (
                    <div 
                      key={artwork.id} 
                      className="group relative border rounded-lg overflow-hidden hover-elevate"
                    >
                      <img
                        src={artwork.dataUrl}
                        alt={artwork.title}
                        className="w-full aspect-[4/3] object-cover cursor-pointer"
                        onClick={() => loadArtwork(artwork)}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => loadArtwork(artwork)}
                          data-testid={`button-load-artwork-${artwork.id}`}
                        >
                          Open
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => deleteArtwork(artwork.id)}
                          data-testid={`button-delete-artwork-${artwork.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs p-1 truncate bg-background/80">{artwork.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
