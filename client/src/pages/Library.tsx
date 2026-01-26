import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Headphones, FileText, Video, Plus, Search, ExternalLink, 
  Trash2, Play, Download, Loader2, Library as LibraryIcon, BookMarked, Upload
} from "lucide-react";
import type { LibraryItem } from "@shared/schema";

const MEDIA_TYPE_ICONS: Record<string, typeof BookOpen> = {
  audio: Headphones,
  ebook: BookOpen,
  pdf: FileText,
  video: Video,
  other: FileText,
};

const MEDIA_TYPE_LABELS: Record<string, string> = {
  audio: "Audio",
  ebook: "E-Book",
  pdf: "PDF",
  video: "Video",
  other: "Other",
};

interface LibrivoxBook {
  id: string;
  title: string;
  authors?: { first_name: string; last_name: string }[];
  url_librivox: string;
  url_zip_file?: string;
  description?: string;
  language: string;
  totaltime?: string;
  num_sections?: string;
}

interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string; birth_year?: number; death_year?: number }[];
  subjects: string[];
  formats: Record<string, string>;
  languages: string[];
}

export default function Library() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("my-library");
  const [librivoxQuery, setLibrivoxQuery] = useState("");
  const [gutenbergQuery, setGutenbergQuery] = useState("");
  const [isSearchingLibrivox, setIsSearchingLibrivox] = useState(false);
  const [isSearchingGutenberg, setIsSearchingGutenberg] = useState(false);
  const [librivoxResults, setLibrivoxResults] = useState<LibrivoxBook[]>([]);
  const [gutenbergResults, setGutenbergResults] = useState<GutenbergBook[]>([]);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    type: "personal",
    mediaType: "audio",
    title: "",
    author: "",
    description: "",
    fileUrl: "",
    externalUrl: "",
    source: "",
  });

  const { data: libraryItems = [], isLoading } = useQuery<LibraryItem[]>({
    queryKey: ["/api/library"],
  });

  const createItemMutation = useMutation({
    mutationFn: async (item: Partial<LibraryItem>) => {
      return apiRequest("POST", "/api/library", item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Item added to library" });
      setAddItemDialogOpen(false);
      resetNewItem();
    },
    onError: () => {
      toast({ title: "Failed to add item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Item removed from library" });
    },
    onError: () => {
      toast({ title: "Failed to remove item", variant: "destructive" });
    },
  });

  const resetNewItem = () => {
    setNewItem({
      type: "personal",
      mediaType: "audio",
      title: "",
      author: "",
      description: "",
      fileUrl: "",
      externalUrl: "",
      source: "",
    });
  };

  const searchLibrivox = async () => {
    if (!librivoxQuery.trim()) return;
    setIsSearchingLibrivox(true);
    try {
      const res = await fetch(`/api/library/search/librivox?q=${encodeURIComponent(librivoxQuery)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLibrivoxResults(data);
      } else {
        throw new Error("Search failed");
      }
    } catch (error) {
      toast({ title: "Failed to search Librivox", variant: "destructive" });
    } finally {
      setIsSearchingLibrivox(false);
    }
  };

  const searchGutenberg = async () => {
    if (!gutenbergQuery.trim()) return;
    setIsSearchingGutenberg(true);
    try {
      const res = await fetch(`/api/library/search/gutenberg?q=${encodeURIComponent(gutenbergQuery)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGutenbergResults(data);
      } else {
        throw new Error("Search failed");
      }
    } catch (error) {
      toast({ title: "Failed to search Project Gutenberg", variant: "destructive" });
    } finally {
      setIsSearchingGutenberg(false);
    }
  };

  const addFromLibrivox = (book: LibrivoxBook) => {
    const authorNames = book.authors?.map(a => `${a.first_name} ${a.last_name}`).join(", ") || "Unknown";
    createItemMutation.mutate({
      type: "public",
      mediaType: "audio",
      title: book.title,
      author: authorNames,
      description: book.description || "",
      externalUrl: book.url_librivox,
      source: "librivox",
      sourceId: book.id,
      duration: book.totaltime,
      chapters: book.num_sections ? parseInt(book.num_sections) : null,
      language: book.language,
    });
  };

  const addFromGutenberg = (book: GutenbergBook) => {
    const authorNames = book.authors.map(a => a.name).join(", ") || "Unknown";
    const readUrl = book.formats["text/html"] || book.formats["application/pdf"] || book.formats["text/plain"];
    createItemMutation.mutate({
      type: "public",
      mediaType: book.formats["application/pdf"] ? "pdf" : "ebook",
      title: book.title,
      author: authorNames,
      description: book.subjects.join(", "),
      externalUrl: readUrl || `https://www.gutenberg.org/ebooks/${book.id}`,
      source: "gutenberg",
      sourceId: String(book.id),
      language: book.languages[0] || "en",
    });
  };

  const handleUploadComplete = (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      const fileUrl = uploadedFile.uploadURL || uploadedFile.meta?.url;
      if (fileUrl) {
        setNewItem(prev => ({ ...prev, fileUrl }));
        toast({ title: "File uploaded successfully!" });
      }
    }
  };

  const handleSaveItem = () => {
    if (!newItem.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    createItemMutation.mutate({
      type: newItem.type,
      mediaType: newItem.mediaType,
      title: newItem.title,
      author: newItem.author || null,
      description: newItem.description || null,
      fileUrl: newItem.fileUrl || null,
      externalUrl: newItem.externalUrl || null,
      source: newItem.source || null,
    });
  };

  const personalItems = libraryItems.filter(item => item.type === "personal");
  const publicItems = libraryItems.filter(item => item.type === "public");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LibraryIcon className="h-6 w-6" />
              Library
            </h1>
            <p className="text-muted-foreground">Manage your personal recordings and discover free books</p>
          </div>
          <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-library-item">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add to Library</DialogTitle>
                <DialogDescription>Add a personal recording or link to an external resource</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newItem.mediaType} onValueChange={(v) => setNewItem(prev => ({ ...prev, mediaType: v }))}>
                    <SelectTrigger data-testid="select-media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audio">Audio Recording</SelectItem>
                      <SelectItem value="ebook">E-Book</SelectItem>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input 
                    id="title"
                    data-testid="input-title"
                    value={newItem.title}
                    onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input 
                    id="author"
                    data-testid="input-author"
                    value={newItem.author}
                    onChange={(e) => setNewItem(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Enter author name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    data-testid="input-description"
                    value={newItem.description}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={104857600}
                    onGetUploadParameters={async (file) => {
                      const res = await fetch(`/api/upload/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`, { credentials: "include" });
                      const data = await res.json();
                      return { method: "PUT" as const, url: data.url, headers: data.headers };
                    }}
                    onComplete={handleUploadComplete}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </ObjectUploader>
                  {newItem.fileUrl && (
                    <p className="text-sm text-green-600">File uploaded!</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="externalUrl">Or Link to External URL</Label>
                  <Input 
                    id="externalUrl"
                    data-testid="input-external-url"
                    value={newItem.externalUrl}
                    onChange={(e) => setNewItem(prev => ({ ...prev, externalUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSaveItem} 
                  disabled={createItemMutation.isPending}
                  data-testid="button-save-item"
                >
                  {createItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-library" data-testid="tab-my-library">
              <BookMarked className="h-4 w-4 mr-2" />
              My Library ({libraryItems.length})
            </TabsTrigger>
            <TabsTrigger value="search-audio" data-testid="tab-search-audio">
              <Headphones className="h-4 w-4 mr-2" />
              Librivox Audio
            </TabsTrigger>
            <TabsTrigger value="search-books" data-testid="tab-search-books">
              <BookOpen className="h-4 w-4 mr-2" />
              Project Gutenberg
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-library" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : libraryItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <LibraryIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Your library is empty</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your own recordings or discover free audiobooks and ebooks
                  </p>
                  <Button onClick={() => setAddItemDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {personalItems.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      My Recordings ({personalItems.length})
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {personalItems.map((item) => (
                        <LibraryItemCard 
                          key={item.id} 
                          item={item} 
                          onDelete={() => deleteItemMutation.mutate(item.id)}
                          isDeleting={deleteItemMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {publicItems.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      Saved Public Resources ({publicItems.length})
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {publicItems.map((item) => (
                        <LibraryItemCard 
                          key={item.id} 
                          item={item} 
                          onDelete={() => deleteItemMutation.mutate(item.id)}
                          isDeleting={deleteItemMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="search-audio" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  Search Librivox Audiobooks
                </CardTitle>
                <CardDescription>
                  Free public domain audiobooks read by volunteers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input 
                    placeholder="Search for audiobooks... (e.g., Pilgrim's Progress, Shakespeare)"
                    value={librivoxQuery}
                    onChange={(e) => setLibrivoxQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchLibrivox()}
                    data-testid="input-search-librivox"
                  />
                  <Button onClick={searchLibrivox} disabled={isSearchingLibrivox} data-testid="button-search-librivox">
                    {isSearchingLibrivox ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                
                {librivoxResults.length === 0 && !isSearchingLibrivox && librivoxQuery && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No audiobooks found. Try a different search term.</p>
                  </div>
                )}
                
                {librivoxResults.length > 0 && (
                  <div className="space-y-3">
                    {librivoxResults.map((book) => (
                      <Card key={book.id} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{book.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {book.authors?.map(a => `${a.first_name} ${a.last_name}`).join(", ") || "Unknown author"}
                              </p>
                              {book.totaltime && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Duration: {book.totaltime} • {book.num_sections} chapters
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(book.url_librivox, "_blank")}
                                data-testid={`button-preview-librivox-${book.id}`}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => addFromLibrivox(book)}
                                disabled={createItemMutation.isPending}
                                data-testid={`button-add-librivox-${book.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search-books" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Search Project Gutenberg
                </CardTitle>
                <CardDescription>
                  Free ebooks from the world's largest collection of public domain literature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input 
                    placeholder="Search for ebooks... (e.g., Pride and Prejudice, Dickens)"
                    value={gutenbergQuery}
                    onChange={(e) => setGutenbergQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchGutenberg()}
                    data-testid="input-search-gutenberg"
                  />
                  <Button onClick={searchGutenberg} disabled={isSearchingGutenberg} data-testid="button-search-gutenberg">
                    {isSearchingGutenberg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                
                {gutenbergResults.length === 0 && !isSearchingGutenberg && gutenbergQuery && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No ebooks found. Try a different search term.</p>
                  </div>
                )}
                
                {gutenbergResults.length > 0 && (
                  <div className="space-y-3">
                    {gutenbergResults.map((book) => (
                      <Card key={book.id} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{book.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {book.authors.map(a => a.name).join(", ") || "Unknown author"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {book.subjects.slice(0, 3).join(" • ")}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(`https://www.gutenberg.org/ebooks/${book.id}`, "_blank")}
                                data-testid={`button-preview-gutenberg-${book.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => addFromGutenberg(book)}
                                disabled={createItemMutation.isPending}
                                data-testid={`button-add-gutenberg-${book.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function LibraryItemCard({ 
  item, 
  onDelete, 
  isDeleting 
}: { 
  item: LibraryItem; 
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const Icon = MEDIA_TYPE_ICONS[item.mediaType] || FileText;
  const url = item.fileUrl || item.externalUrl;

  return (
    <Card className="hover-elevate" data-testid={`card-library-item-${item.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 rounded-md bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{item.title}</CardTitle>
              {item.author && (
                <p className="text-sm text-muted-foreground truncate">{item.author}</p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
        )}
        {item.source && (
          <Badge variant="outline" className="text-xs mb-3">
            {item.source === "librivox" ? "LibriVox" : item.source === "gutenberg" ? "Project Gutenberg" : item.source}
          </Badge>
        )}
        <div className="flex items-center gap-2">
          {url && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => window.open(url, "_blank")}
              data-testid={`button-open-item-${item.id}`}
            >
              {item.mediaType === "audio" ? <Play className="h-4 w-4 mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
              {item.mediaType === "audio" ? "Play" : "Open"}
            </Button>
          )}
          <Button 
            size="icon" 
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting}
            data-testid={`button-delete-item-${item.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
