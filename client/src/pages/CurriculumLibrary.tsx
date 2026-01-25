import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, Plus, Trash2, ExternalLink, BookOpen, Filter, Search } from "lucide-react";
import type { CurriculumResource } from "@shared/schema";

export default function CurriculumLibrary() {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterTerm, setFilterTerm] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resources = [], isLoading } = useQuery<CurriculumResource[]>({
    queryKey: ["/api/curriculum-resources"],
  });

  const { data: subjects = [] } = useQuery<string[]>({
    queryKey: ["/api/curriculum-resources/subjects"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { csvContent: string; subjectName: string }) => {
      return apiRequest("POST", "/api/curriculum-resources/upload", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload successful",
        description: `${data.count} resources imported`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources/subjects"] });
      setUploadOpen(false);
      setCsvContent("");
      setSubjectName("");
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to import resources",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/curriculum-resources/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Resource deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources"] });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (subject: string) => {
      return apiRequest("DELETE", `/api/curriculum-resources/subject/${encodeURIComponent(subject)}`);
    },
    onSuccess: () => {
      toast({ title: "All resources for subject deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources/subjects"] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleUpload = () => {
    if (!csvContent || !subjectName) {
      toast({
        title: "Missing information",
        description: "Please provide both a CSV file and subject name",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({ csvContent, subjectName });
  };

  const uniqueTerms = Array.from(new Set(resources.map(r => r.term).filter(Boolean))).sort();

  const filteredResources = resources.filter(r => {
    if (filterSubject !== "all" && r.subject !== filterSubject) return false;
    if (filterTerm !== "all" && r.term !== filterTerm) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        r.subject?.toLowerCase().includes(query) ||
        r.title?.toLowerCase().includes(query) ||
        r.chapters?.toLowerCase().includes(query) ||
        r.notes?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Curriculum Library</h1>
            <p className="text-muted-foreground mt-1">
              Upload and manage your curriculum resources
            </p>
          </div>
          
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-curriculum">
                <Upload className="h-4 w-4 mr-2" />
                Upload Spreadsheet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Curriculum Spreadsheet</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with your curriculum. The file should have columns like: Term, Week, Form, Subject, Link, Chapters.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-name">Subject Name</Label>
                  <Input
                    id="subject-name"
                    placeholder="e.g., Language Arts, History"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    data-testid="input-subject-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    data-testid="input-csv-file"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="csv-content">Or paste CSV content</Label>
                  <Textarea
                    id="csv-content"
                    placeholder="Term,Week,Form,Subject,Link,Chapters"
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    className="min-h-[120px] font-mono text-sm"
                    data-testid="textarea-csv-content"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={uploadMutation.isPending}
                  data-testid="button-submit-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-resources"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-subject">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterTerm} onValueChange={setFilterTerm}>
                  <SelectTrigger className="w-[140px]" data-testid="select-filter-term">
                    <SelectValue placeholder="All Terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {uniqueTerms.map(term => (
                      <SelectItem key={term} value={term!}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <BookOpen className="h-8 w-8 text-muted-foreground animate-pulse" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No resources found</h3>
                <p className="text-muted-foreground mb-4">
                  {resources.length === 0 
                    ? "Upload a spreadsheet to get started" 
                    : "Try adjusting your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Week</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Chapters/Description</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map((resource) => (
                      <TableRow key={resource.id} data-testid={`row-resource-${resource.id}`}>
                        <TableCell>
                          <Badge variant="secondary">{resource.subject}</Badge>
                        </TableCell>
                        <TableCell>{resource.term || "-"}</TableCell>
                        <TableCell>{resource.week || "-"}</TableCell>
                        <TableCell>
                          {resource.formLevel ? (
                            <Badge variant="outline">{resource.formLevel}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {resource.chapters || resource.title || "-"}
                        </TableCell>
                        <TableCell>
                          {resource.resourceLink ? (
                            <a 
                              href={resource.resourceLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(resource.id)}
                            data-testid={`button-delete-resource-${resource.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {subjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manage Subjects</CardTitle>
              <CardDescription>Delete all resources for a subject</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {subjects.map(subject => (
                  <Badge 
                    key={subject} 
                    variant="outline" 
                    className="py-2 px-3 cursor-pointer hover-elevate"
                    onClick={() => {
                      if (confirm(`Delete all resources for "${subject}"?`)) {
                        deleteSubjectMutation.mutate(subject);
                      }
                    }}
                    data-testid={`badge-subject-${subject}`}
                  >
                    {subject}
                    <Trash2 className="h-3 w-3 ml-2 text-destructive" />
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
