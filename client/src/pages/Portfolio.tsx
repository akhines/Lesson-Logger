import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  FolderOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Tag,
  Plus,
  Image,
  FileText,
  Music,
  Loader2,
  Eye,
  Trash2,
  Edit2,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Student, EvidenceUpload, PortfolioLabel, Subject } from "@shared/schema";

type EvidenceWithDetails = EvidenceUpload & {
  studentName?: string;
  lessonTitle?: string;
  subjectName?: string;
  labels?: PortfolioLabel[];
};

export default function Portfolio() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [reviewingEvidence, setReviewingEvidence] = useState<EvidenceWithDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [newLabelDialogOpen, setNewLabelDialogOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6B7280");
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStudentId, setExportStudentId] = useState<string>("all");
  const [exportLabelId, setExportLabelId] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: labels = [] } = useQuery<PortfolioLabel[]>({
    queryKey: ["/api/portfolio/labels"],
  });

  const { data: pendingEvidence = [], isLoading: pendingLoading } = useQuery<EvidenceWithDetails[]>({
    queryKey: ["/api/portfolio/evidence/pending"],
  });

  const { data: allEvidence = [], isLoading: evidenceLoading } = useQuery<EvidenceWithDetails[]>({
    queryKey: ["/api/portfolio/evidence", selectedStudentId],
    queryFn: async () => {
      const url = selectedStudentId === "all" 
        ? "/api/portfolio/evidence" 
        : `/api/portfolio/evidence?studentId=${selectedStudentId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch evidence");
      return res.json();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes, labelIds }: { id: number; status: string; notes?: string; labelIds?: number[] }) => {
      return apiRequest("PATCH", `/api/portfolio/evidence/${id}/review`, {
        reviewStatus: status,
        reviewNotes: notes,
        labelIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/evidence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/evidence/pending"] });
      setReviewingEvidence(null);
      setReviewNotes("");
      setSelectedLabels([]);
      toast({ title: "Review saved", description: "Evidence has been reviewed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save review.", variant: "destructive" });
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/portfolio/labels", {
        name: newLabelName,
        color: newLabelColor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/labels"] });
      setNewLabelDialogOpen(false);
      setNewLabelName("");
      setNewLabelColor("#6B7280");
      toast({ title: "Label created", description: "New portfolio label has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create label.", variant: "destructive" });
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/portfolio/labels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/labels"] });
      toast({ title: "Label deleted" });
    },
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/portfolio/evidence/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/evidence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/evidence/pending"] });
      toast({ title: "Evidence deleted" });
    },
  });

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image": return <Image className="h-5 w-5 text-blue-500" />;
      case "audio": return <Music className="h-5 w-5 text-purple-500" />;
      case "document": 
      case "pdf": return <FileText className="h-5 w-5 text-red-500" />;
      default: return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const handleStartReview = (evidence: EvidenceWithDetails) => {
    setReviewingEvidence(evidence);
    setReviewNotes(evidence.reviewNotes || "");
    setSelectedLabels(evidence.labels?.map(l => l.id) || []);
  };

  const handleApprove = () => {
    if (!reviewingEvidence) return;
    reviewMutation.mutate({
      id: reviewingEvidence.id,
      status: "approved",
      notes: reviewNotes,
      labelIds: selectedLabels,
    });
  };

  const handleReject = () => {
    if (!reviewingEvidence) return;
    reviewMutation.mutate({
      id: reviewingEvidence.id,
      status: "rejected",
      notes: reviewNotes,
      labelIds: selectedLabels,
    });
  };

  const toggleLabel = (labelId: number) => {
    setSelectedLabels(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportStudentId !== "all") params.append("studentId", exportStudentId);
      if (exportLabelId !== "all") params.append("labelId", exportLabelId);
      
      const url = `/api/portfolio/export${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "portfolio.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setExportDialogOpen(false);
      toast({ title: "Export complete", description: "Your portfolio PDF has been downloaded." });
    } catch (error) {
      toast({ title: "Export failed", description: "Unable to generate PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredEvidence = selectedTab === "pending" 
    ? pendingEvidence 
    : allEvidence.filter(e => {
        if (selectedTab === "approved") return e.reviewStatus === "approved";
        if (selectedTab === "rejected") return e.reviewStatus === "rejected";
        return true;
      });

  const renderEvidenceCard = (evidence: EvidenceWithDetails) => {
    const student = students.find(s => s.id === evidence.studentId);
    
    return (
      <Card key={evidence.id} className="hover-elevate" data-testid={`card-evidence-${evidence.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {evidence.fileType === "image" ? (
                <div 
                  className="w-16 h-16 rounded-md bg-muted overflow-hidden cursor-pointer"
                  onClick={() => setPreviewUrl(evidence.fileUrl)}
                >
                  <img 
                    src={evidence.fileUrl} 
                    alt={evidence.title || "Evidence"} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                  {getFileIcon(evidence.fileType)}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium truncate">{evidence.title || evidence.fileName || "Untitled"}</h4>
                  <p className="text-sm text-muted-foreground">
                    {student?.name || "Unknown Student"} 
                    {evidence.lessonTitle && ` • ${evidence.lessonTitle}`}
                  </p>
                  {evidence.subjectName && (
                    <Badge variant="secondary" className="text-xs mt-1" data-testid={`badge-subject-${evidence.id}`}>
                      {evidence.subjectName}
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {evidence.createdAt && format(new Date(evidence.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(evidence.reviewStatus)}
                </div>
              </div>
              
              {evidence.labels && evidence.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {evidence.labels.map(label => (
                    <Badge 
                      key={label.id} 
                      variant="outline" 
                      style={{ borderColor: label.color || "#6B7280", color: label.color || "#6B7280" }}
                      className="text-xs"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {label.name}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleStartReview(evidence)}
                  data-testid={`button-review-evidence-${evidence.id}`}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Review
                </Button>
                {evidence.fileType === "image" && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setPreviewUrl(evidence.fileUrl)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                )}
                {(evidence.fileType === "document" || evidence.fileType === "pdf") && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => window.open(evidence.fileUrl, "_blank")}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Open PDF
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteEvidenceMutation.mutate(evidence.id)}
                  data-testid={`button-delete-evidence-${evidence.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">Portfolio</h1>
            <p className="text-muted-foreground">Review and organize student work evidence</p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {pendingEvidence.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                <Clock className="h-4 w-4 mr-1" />
                {pendingEvidence.length} pending review
              </Badge>
            )}
            
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-export-portfolio">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Portfolio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Export approved student work as a PDF document. You can filter by student or label.
                  </p>
                  <div className="space-y-2">
                    <Label>Student (optional)</Label>
                    <Select value={exportStudentId} onValueChange={setExportStudentId}>
                      <SelectTrigger data-testid="select-export-student">
                        <SelectValue placeholder="All students" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Label (optional)</Label>
                    <Select value={exportLabelId} onValueChange={setExportLabelId}>
                      <SelectTrigger data-testid="select-export-label">
                        <SelectValue placeholder="All labels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Labels</SelectItem>
                        {labels.map(label => (
                          <SelectItem key={label.id} value={label.id.toString()}>
                            {label.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    data-testid="button-confirm-export"
                  >
                    {isExporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={newLabelDialogOpen} onOpenChange={setNewLabelDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-create-label">
                  <Plus className="h-4 w-4 mr-2" />
                  New Label
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Portfolio Label</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Label Name</Label>
                    <Input 
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="e.g., Best Work, Needs Improvement, Art Project"
                      data-testid="input-label-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="w-10 h-10 rounded-md cursor-pointer"
                      />
                      <Input 
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={() => createLabelMutation.mutate()}
                    disabled={!newLabelName.trim() || createLabelMutation.isPending}
                    data-testid="button-save-label"
                  >
                    {createLabelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Label
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="pending" data-testid="tab-pending">
                <Clock className="h-4 w-4 mr-2" />
                Pending ({pendingEvidence.length})
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">
                <XCircle className="h-4 w-4 mr-2" />
                Rejected
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                <FolderOpen className="h-4 w-4 mr-2" />
                All Evidence
              </TabsTrigger>
            </TabsList>
            
            {selectedTab !== "pending" && (
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-48" data-testid="select-student-filter">
                  <SelectValue placeholder="Filter by student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {(pendingLoading || evidenceLoading) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEvidence.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No evidence found</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTab === "pending" 
                      ? "There are no uploads waiting for review."
                      : "No evidence matches the current filters."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredEvidence.map(evidence => renderEvidenceCard(evidence))}
              </div>
            )}
          </div>
        </Tabs>

        {labels.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Portfolio Labels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {labels.map(label => (
                  <div 
                    key={label.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: label.color || "#6B7280" }}
                    />
                    <span className="text-sm font-medium">{label.name}</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6"
                      onClick={() => deleteLabelMutation.mutate(label.id)}
                      data-testid={`button-delete-label-${label.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!reviewingEvidence} onOpenChange={(open) => !open && setReviewingEvidence(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Evidence</DialogTitle>
          </DialogHeader>
          
          {reviewingEvidence && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {reviewingEvidence.fileType === "image" ? (
                  <div className="w-32 h-32 rounded-lg bg-muted overflow-hidden">
                    <img 
                      src={reviewingEvidence.fileUrl} 
                      alt={reviewingEvidence.title || "Evidence"} 
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewUrl(reviewingEvidence.fileUrl)}
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center">
                    {getFileIcon(reviewingEvidence.fileType)}
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="font-medium text-lg">
                    {reviewingEvidence.title || reviewingEvidence.fileName || "Untitled"}
                  </h3>
                  <p className="text-muted-foreground">
                    {students.find(s => s.id === reviewingEvidence.studentId)?.name}
                    {reviewingEvidence.lessonTitle && ` • ${reviewingEvidence.lessonTitle}`}
                  </p>
                  {reviewingEvidence.subjectName && (
                    <Badge variant="secondary" className="mt-1" data-testid="review-subject-badge">
                      {reviewingEvidence.subjectName}
                    </Badge>
                  )}
                  {reviewingEvidence.description && (
                    <p className="text-sm mt-2">{reviewingEvidence.description}</p>
                  )}
                  <div className="mt-2">
                    {getStatusBadge(reviewingEvidence.reviewStatus)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Labels</Label>
                <div className="flex flex-wrap gap-2">
                  {labels.map(label => (
                    <Badge 
                      key={label.id}
                      variant={selectedLabels.includes(label.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={selectedLabels.includes(label.id) 
                        ? { backgroundColor: label.color || "#6B7280" } 
                        : { borderColor: label.color || "#6B7280", color: label.color || "#6B7280" }}
                      onClick={() => toggleLabel(label.id)}
                      data-testid={`toggle-label-${label.id}`}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {label.name}
                    </Badge>
                  ))}
                  {labels.length === 0 && (
                    <p className="text-sm text-muted-foreground">No labels created yet.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Review Notes</Label>
                <Textarea 
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this work..."
                  rows={3}
                  data-testid="textarea-review-notes"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={reviewMutation.isPending}
              data-testid="button-reject"
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={reviewMutation.isPending}
              data-testid="button-approve"
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              <img 
                src={previewUrl} 
                alt="Evidence preview" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
