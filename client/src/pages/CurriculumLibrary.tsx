import { useState, useMemo } from "react";
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
import { Upload, Trash2, ExternalLink, BookOpen, Filter, Search, ArrowRight, ArrowLeft } from "lucide-react";
import type { CurriculumResource } from "@shared/schema";
import Papa from "papaparse";

const TARGET_FIELDS = [
  { key: "term", label: "Term", description: "Term number/name (e.g., Term 1, Fall)" },
  { key: "week", label: "Week", description: "Week number" },
  { key: "form", label: "Form Level", description: "Form 1, 2, or 3" },
  { key: "link", label: "Resource Link", description: "URL to the resource" },
  { key: "chapters", label: "Chapters/Description", description: "Chapter numbers or lesson description" },
  { key: "title", label: "Title", description: "Lesson or resource title" },
  { key: "notes", label: "Notes", description: "Additional notes" },
];

type ColumnMapping = Record<string, string>;

export default function CurriculumLibrary() {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvContent, setCsvContent] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterTerm, setFilterTerm] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  const { data: resources = [], isLoading } = useQuery<CurriculumResource[]>({
    queryKey: ["/api/curriculum-resources"],
  });

  const { data: subjects = [] } = useQuery<string[]>({
    queryKey: ["/api/curriculum-resources/subjects"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { csvContent: string; subjectName: string; columnMapping: ColumnMapping }) => {
      return apiRequest("POST", "/api/curriculum-resources/upload", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload successful",
        description: `${data.count} resources imported`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curriculum-resources/subjects"] });
      resetUploadState();
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

  const resetUploadState = () => {
    setUploadOpen(false);
    setUploadStep("upload");
    setCsvContent("");
    setSubjectName("");
    setDetectedHeaders([]);
    setParsedData([]);
    setColumnMapping({});
  };

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

  const parseAndDetectColumns = () => {
    if (!csvContent) {
      toast({
        title: "No content",
        description: "Please upload a file or paste CSV content",
        variant: "destructive",
      });
      return;
    }

    // Try parsing with different delimiters
    const delimiters = [",", "\t", ";", "|"];
    let bestResult: Papa.ParseResult<any> | null = null;
    let bestColumnCount = 0;
    
    for (const delimiter of delimiters) {
      const result = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: delimiter,
        quoteChar: '"',
        escapeChar: '"',
      });
      
      const columnCount = result.meta.fields?.length || 0;
      if (columnCount > bestColumnCount && result.data.length > 0) {
        bestResult = result;
        bestColumnCount = columnCount;
      }
    }
    
    if (!bestResult || bestResult.data.length === 0) {
      toast({
        title: "Parse error",
        description: "Could not parse the file. Make sure it's a valid spreadsheet format.",
        variant: "destructive",
      });
      return;
    }

    const headers = bestResult.meta.fields || [];
    setDetectedHeaders(headers);
    setParsedData(bestResult.data as any[]);
    
    const autoMapping: ColumnMapping = {};
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().replace(/\s+/g, '_');
      if (lowerHeader.includes('term')) autoMapping[header] = 'term';
      else if (lowerHeader.includes('week')) autoMapping[header] = 'week';
      else if (lowerHeader.includes('form')) autoMapping[header] = 'form';
      else if (lowerHeader.includes('link') || lowerHeader.includes('url') || lowerHeader.includes('resource')) autoMapping[header] = 'link';
      else if (lowerHeader.includes('chapter') || lowerHeader.includes('lesson') || lowerHeader.includes('description')) autoMapping[header] = 'chapters';
      else if (lowerHeader.includes('title') || lowerHeader.includes('name')) autoMapping[header] = 'title';
      else if (lowerHeader.includes('note')) autoMapping[header] = 'notes';
    });
    setColumnMapping(autoMapping);
    
    setUploadStep("map");
  };

  const handleImport = () => {
    if (!subjectName) {
      toast({
        title: "Missing subject",
        description: "Please enter a subject name",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({ csvContent, subjectName, columnMapping });
  };

  const previewData = useMemo(() => {
    return parsedData.slice(0, 5).map(row => {
      const mapped: Record<string, any> = {};
      Object.entries(columnMapping).forEach(([csvCol, targetField]) => {
        if (targetField && targetField !== "skip") {
          mapped[targetField] = row[csvCol];
        }
      });
      return mapped;
    });
  }, [parsedData, columnMapping]);

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
          
          <Dialog open={uploadOpen} onOpenChange={(open) => {
            if (!open) resetUploadState();
            else setUploadOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-curriculum">
                <Upload className="h-4 w-4 mr-2" />
                Upload Spreadsheet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {uploadStep === "upload" && "Step 1: Upload Spreadsheet"}
                  {uploadStep === "map" && "Step 2: Map Columns"}
                  {uploadStep === "preview" && "Step 3: Preview & Import"}
                </DialogTitle>
                <DialogDescription>
                  {uploadStep === "upload" && "Upload a CSV file or paste content to get started"}
                  {uploadStep === "map" && "Match your spreadsheet columns to the right fields"}
                  {uploadStep === "preview" && "Review the data before importing"}
                </DialogDescription>
              </DialogHeader>
              
              {uploadStep === "upload" && (
                <div className="space-y-4 py-4">
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
                      className="min-h-[150px] font-mono text-sm"
                      data-testid="textarea-csv-content"
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={resetUploadState}>
                      Cancel
                    </Button>
                    <Button onClick={parseAndDetectColumns} data-testid="button-next-step">
                      Next: Map Columns <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {uploadStep === "map" && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject-name">Subject Name (required)</Label>
                    <Input
                      id="subject-name"
                      placeholder="e.g., Language Arts, History"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      data-testid="input-subject-name"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Column Mapping</Label>
                    <p className="text-sm text-muted-foreground">
                      We detected {detectedHeaders.length} column{detectedHeaders.length !== 1 ? 's' : ''} and {parsedData.length} row{parsedData.length !== 1 ? 's' : ''}.
                      {detectedHeaders.length === 1 && (
                        <span className="text-destructive block mt-1">
                          Only 1 column detected - your file may not be comma-separated. Try exporting from your spreadsheet as CSV (comma-delimited).
                        </span>
                      )}
                    </p>
                    
                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                      {detectedHeaders.map((header) => (
                        <div key={header} className="flex items-center justify-between p-3 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{header}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Sample: {parsedData[0]?.[header] || "(empty)"}
                            </div>
                          </div>
                          <Select
                            value={columnMapping[header] || "skip"}
                            onValueChange={(value) => setColumnMapping(prev => ({
                              ...prev,
                              [header]: value
                            }))}
                          >
                            <SelectTrigger className="w-[180px]" data-testid={`select-map-${header}`}>
                              <SelectValue placeholder="Skip this column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Skip this column</SelectItem>
                              {TARGET_FIELDS.map(field => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {parsedData.length > 0 && (
                    <div className="space-y-2">
                      <Label>Raw Data Preview (first 3 rows)</Label>
                      <div className="border rounded-md overflow-x-auto text-xs">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {detectedHeaders.map((header, idx) => (
                                <TableHead key={idx} className="text-xs whitespace-nowrap">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.slice(0, 3).map((row, i) => (
                              <TableRow key={i}>
                                {detectedHeaders.map((header, idx) => (
                                  <TableCell key={idx} className="max-w-[150px] truncate text-xs">
                                    {row[header] || "(empty)"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setUploadStep("upload")}>
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      disabled={uploadMutation.isPending || !subjectName}
                      data-testid="button-import"
                    >
                      {uploadMutation.isPending ? "Importing..." : `Import ${parsedData.length} rows`}
                    </Button>
                  </DialogFooter>
                </div>
              )}
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
