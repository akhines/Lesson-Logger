import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Search, Loader2, BookMarked, Headphones, ExternalLink, Sparkles, Bot } from "lucide-react";
import type { LibraryItem, Student } from "@shared/schema";

type GutenbergResult = {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
};

export default function StudentLibrary() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [gutenbergResults, setGutenbergResults] = useState<GutenbergResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: currentStudent, isLoading: studentLoading, isError: studentError } = useQuery<Student | null>({
    queryKey: ["/api/student-portal/me"],
    queryFn: async () => {
      const res = await fetch("/api/student-portal/me");
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error("Failed to fetch student");
      }
      return res.json();
    },
  });

  const { data: libraryItems = [], isLoading: libraryLoading } = useQuery<LibraryItem[]>({
    queryKey: ["/api/student-portal/library"],
    queryFn: async () => {
      const res = await fetch("/api/student-portal/library");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentStudent,
  });

  useEffect(() => {
    if (!studentLoading && !currentStudent) {
      setLocation("/student-login");
    }
  }, [studentLoading, currentStudent, setLocation]);

  const searchGutenberg = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/student-portal/search-gutenberg?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setGutenbergResults(data.results || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredLibraryItems = libraryItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (studentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-teal-50 to-white dark:from-teal-950 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (studentError || !currentStudent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white dark:from-teal-950 dark:to-background">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/student-portal">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="h-6 w-6 text-teal-500" />
            <h1 className="text-xl font-display font-bold">Library</h1>
          </div>
          <Button variant="outline" size="sm" asChild data-testid="button-ask-helper">
            <Link href="/student-helper">
              <Bot className="h-4 w-4 mr-2" />
              Ask Helper
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && activeTab === "discover" && searchGutenberg()}
            className="pl-10 h-12 text-lg"
            data-testid="input-library-search"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="library" className="text-base" data-testid="tab-my-library">
              <BookMarked className="h-4 w-4 mr-2" />
              My Library
            </TabsTrigger>
            <TabsTrigger value="discover" className="text-base" data-testid="tab-discover">
              <Sparkles className="h-4 w-4 mr-2" />
              Discover Books
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-4">
            {libraryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : filteredLibraryItems.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Books Yet</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "No books match your search." : "Your library is empty. Try the Discover tab to find books!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredLibraryItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover-elevate" data-testid={`card-library-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {item.coverImageUrl ? (
                          <img 
                            src={item.coverImageUrl} 
                            alt={item.title}
                            className="w-16 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                            {item.mediaType === "audio" ? (
                              <Headphones className="h-8 w-8 text-muted-foreground" />
                            ) : (
                              <BookOpen className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2">{item.title}</h3>
                          {item.author && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{item.author}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {item.mediaType === "audio" ? "Audiobook" : item.mediaType === "ebook" ? "Ebook" : item.mediaType}
                            </Badge>
                            {item.source && (
                              <Badge variant="outline" className="text-xs">{item.source}</Badge>
                            )}
                          </div>
                          {item.externalUrl && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => window.open(item.externalUrl!, "_blank")}
                              data-testid={`button-open-item-${item.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Open
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-muted-foreground">
                Search for free books from Project Gutenberg!
              </p>
              <Button 
                onClick={searchGutenberg} 
                disabled={!searchQuery.trim() || isSearching}
                className="mt-2"
                data-testid="button-search-gutenberg"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Books
              </Button>
            </div>

            {isSearching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : gutenbergResults.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Sparkles className="h-16 w-16 mx-auto text-teal-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Discover Great Books</h3>
                  <p className="text-muted-foreground">
                    Type a title or author name above and click Search to find free books to read!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {gutenbergResults.map((book) => (
                  <Card key={book.id} className="overflow-hidden hover-elevate" data-testid={`card-gutenberg-${book.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {book.coverUrl ? (
                          <img 
                            src={book.coverUrl} 
                            alt={book.title}
                            className="w-16 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                            <BookOpen className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2">{book.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-2"
                            onClick={() => window.open(`https://www.gutenberg.org/ebooks/${book.id}`, "_blank")}
                            data-testid={`button-read-gutenberg-${book.id}`}
                          >
                            <BookOpen className="h-3 w-3 mr-1" />
                            Read on Gutenberg
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
