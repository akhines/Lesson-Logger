import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Search, Loader2, BookMarked, Headphones, ExternalLink, Sparkles, Bot, Star } from "lucide-react";
import type { LibraryItem, Student } from "@shared/schema";

type GutenbergResult = {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
};

// Curated Charlotte Mason-style classic children's literature (age-appropriate for elementary students)
const CLASSIC_BOOKS = [
  // Fairy Tales & Folklore
  { id: 2591, title: "Grimm's Fairy Tales", author: "Brothers Grimm", category: "Fairy Tales", librivoxId: "grimms-fairy-tales" },
  { id: 19993, title: "Andersen's Fairy Tales", author: "Hans Christian Andersen", category: "Fairy Tales", librivoxId: "andersens-fairy-tales" },
  { id: 973, title: "The Jungle Book", author: "Rudyard Kipling", category: "Adventure", librivoxId: "jungle-book" },
  
  // Classic Children's Fiction
  { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", category: "Fantasy", librivoxId: "alices-adventures-in-wonderland" },
  { id: 12, title: "Through the Looking-Glass", author: "Lewis Carroll", category: "Fantasy", librivoxId: "through-the-looking-glass" },
  { id: 120, title: "Treasure Island", author: "Robert Louis Stevenson", category: "Adventure", librivoxId: "treasure-island" },
  { id: 74, title: "The Adventures of Tom Sawyer", author: "Mark Twain", category: "Adventure", librivoxId: "adventures-of-tom-sawyer" },
  { id: 514, title: "Little Women", author: "Louisa May Alcott", category: "Family", librivoxId: "little-women" },
  { id: 1260, title: "The Velveteen Rabbit", author: "Margery Williams", category: "Family", librivoxId: null },
  
  // Nature & Animals
  { id: 103, title: "Around the World in Eighty Days", author: "Jules Verne", category: "Adventure", librivoxId: "around-the-world-in-80-days" },
  { id: 215, title: "The Call of the Wild", author: "Jack London", category: "Animals", librivoxId: "call-of-the-wild" },
  { id: 45, title: "Anne of Green Gables", author: "L.M. Montgomery", category: "Family", librivoxId: "anne-of-green-gables" },
  { id: 46, title: "Anne of Avonlea", author: "L.M. Montgomery", category: "Family", librivoxId: "anne-of-avonlea" },
  { id: 54, title: "The Wind in the Willows", author: "Kenneth Grahame", category: "Animals", librivoxId: "wind-in-the-willows" },
  { id: 16, title: "Peter Pan", author: "J.M. Barrie", category: "Fantasy", librivoxId: "peter-pan" },
  
  // Aesop & Fables
  { id: 21, title: "Aesop's Fables", author: "Aesop", category: "Fables", librivoxId: "aesops-fables-volume-01" },
  
  // Poetry & Verse
  { id: 1065, title: "A Child's Garden of Verses", author: "Robert Louis Stevenson", category: "Poetry", librivoxId: "childs-garden-of-verses" },
  
  // Classic Stories
  { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", category: "Mystery", librivoxId: "adventures-of-sherlock-holmes" },
  { id: 244, title: "A Study in Scarlet", author: "Arthur Conan Doyle", category: "Mystery", librivoxId: null },
  
  // Science & Nature
  { id: 1228, title: "The Swiss Family Robinson", author: "Johann David Wyss", category: "Adventure", librivoxId: "swiss-family-robinson" },
  { id: 164, title: "Twenty Thousand Leagues Under the Sea", author: "Jules Verne", category: "Adventure", librivoxId: "twenty-thousand-leagues-under-the-sea" },
  
  // More Fairy Tales
  { id: 708, title: "Just So Stories", author: "Rudyard Kipling", category: "Fairy Tales", librivoxId: "just-so-stories" },
  { id: 236, title: "The Wonderful Wizard of Oz", author: "L. Frank Baum", category: "Fantasy", librivoxId: "wonderful-wizard-of-oz" },
  { id: 30852, title: "Heidi", author: "Johanna Spyri", category: "Family", librivoxId: "heidi" },
  { id: 35, title: "The Secret Garden", author: "Frances Hodgson Burnett", category: "Family", librivoxId: "secret-garden" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Fairy Tales": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "Fantasy": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Adventure": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Family": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "Animals": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Fables": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Poetry": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Classic": "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  "Mystery": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Mythology": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
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
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="library" className="text-base" data-testid="tab-my-library">
              <BookMarked className="h-4 w-4 mr-2" />
              My Library
            </TabsTrigger>
            <TabsTrigger value="classics" className="text-base" data-testid="tab-classics">
              <Star className="h-4 w-4 mr-2" />
              Classics
            </TabsTrigger>
            <TabsTrigger value="discover" className="text-base" data-testid="tab-discover">
              <Sparkles className="h-4 w-4 mr-2" />
              Discover
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
          
          <TabsContent value="classics" className="space-y-4">
            <Card className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="h-5 w-5 text-amber-500" />
                  <h3 className="font-display font-bold text-amber-800 dark:text-amber-200">Charlotte Mason Classics</h3>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Timeless stories, fairy tales, and literature perfect for young readers. Read on Project Gutenberg or listen on Librivox!
                </p>
              </CardContent>
            </Card>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {CLASSIC_BOOKS.filter(book => 
                !searchQuery || 
                book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.category.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((book) => (
                <Card key={book.id} className="overflow-hidden hover-elevate" data-testid={`card-classic-${book.id}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-24 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-clamp-2" data-testid={`text-classic-title-${book.id}`}>{book.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1" data-testid={`text-classic-author-${book.id}`}>{book.author}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge className={`text-xs ${CATEGORY_COLORS[book.category] || ''}`} data-testid={`badge-classic-category-${book.id}`}>
                            {book.category}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button 
                            variant="outline"
                            onClick={() => window.open(`https://www.gutenberg.org/ebooks/${book.id}`, "_blank")}
                            data-testid={`button-read-classic-${book.id}`}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Read
                          </Button>
                          {book.librivoxId && (
                            <Button 
                              variant="outline"
                              onClick={() => window.open(`https://librivox.org/search?q=${encodeURIComponent(book.title)}&search_form=advanced`, "_blank")}
                              data-testid={`button-listen-classic-${book.id}`}
                            >
                              <Headphones className="h-4 w-4 mr-2" />
                              Listen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {CLASSIC_BOOKS.filter(book => 
              !searchQuery || 
              book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
              book.category.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Star className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Matching Classics</h3>
                  <p className="text-muted-foreground">
                    Try a different search term or clear the search to see all classics.
                  </p>
                </CardContent>
              </Card>
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
