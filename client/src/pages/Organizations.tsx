import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, GraduationCap, Plus, Settings, Trash2, UserPlus, BookOpen, Loader2, Calendar, FileText, Eye, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";

type Organization = {
  id: number;
  name: string;
  description?: string;
  userRole?: string;
};

type OrgMembership = {
  id: number;
  organizationId: number;
  userId: string;
  role: string;
  status: string;
  canViewAllWork?: boolean;
  user?: { firstName?: string; lastName?: string; email?: string };
};

type Class = {
  id: number;
  organizationId: number;
  teacherUserId: string;
  name: string;
  description?: string;
  gradeLevel?: string;
  isActive: boolean;
};

type ClassEnrollment = {
  id: number;
  classId: number;
  studentId: number;
  status: string;
  student: { id: number; name: string; color?: string };
};

type ClassLesson = {
  id: number;
  classId: number;
  teacherUserId: string;
  title: string;
  description?: string;
  instructions?: string;
  dueDate?: string;
  requiresEvidence: boolean;
  isActive: boolean;
  createdAt: string;
};

type Submission = {
  id: number;
  classLessonId: number;
  studentId: number;
  studentName: string;
  title?: string;
  fileUrl: string;
  fileType: string;
  reviewStatus: string;
  sharedWithTeacher: boolean;
  createdAt: string;
  feedback?: Array<{ id: number; feedback: string; grade?: string; createdAt: string }>;
};

export default function Organizations() {
  const { toast } = useToast();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateLessonDialog, setShowCreateLessonDialog] = useState(false);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [newLessonInstructions, setNewLessonInstructions] = useState("");
  const [newLessonDueDate, setNewLessonDueDate] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackGrade, setFeedbackGrade] = useState("");
  const [classTab, setClassTab] = useState<"students" | "lessons">("lessons");

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: orgDetails } = useQuery<Organization>({
    queryKey: ["/api/organizations", selectedOrg?.id],
    enabled: !!selectedOrg,
  });

  const { data: members = [] } = useQuery<OrgMembership[]>({
    queryKey: ["/api/organizations", selectedOrg?.id, "members"],
    enabled: !!selectedOrg,
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["/api/organizations", selectedOrg?.id, "classes"],
    enabled: !!selectedOrg,
  });

  const { data: classEnrollments = [] } = useQuery<ClassEnrollment[]>({
    queryKey: ["/api/classes", selectedClassId, "students"],
    enabled: !!selectedClassId,
  });

  const { data: classLessons = [] } = useQuery<ClassLesson[]>({
    queryKey: ["/api/classes", selectedClassId, "lessons"],
    enabled: !!selectedClassId,
  });

  const { data: submissions = [], refetch: refetchSubmissions } = useQuery<Submission[]>({
    queryKey: ["/api/class-lessons", selectedLessonId, "submissions"],
    enabled: !!selectedLessonId && showSubmissionsDialog,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return apiRequest("POST", "/api/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setShowCreateOrgDialog(false);
      setNewOrgName("");
      setNewOrgDescription("");
      toast({ title: "Organization created successfully" });
    },
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return apiRequest("POST", `/api/organizations/${selectedOrg?.id}/classes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", selectedOrg?.id, "classes"] });
      setShowCreateClassDialog(false);
      setNewClassName("");
      setNewClassDescription("");
      toast({ title: "Class created successfully" });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; instructions?: string; dueDate?: string }) => {
      return apiRequest("POST", `/api/classes/${selectedClassId}/lessons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes", selectedClassId, "lessons"] });
      setShowCreateLessonDialog(false);
      setNewLessonTitle("");
      setNewLessonDescription("");
      setNewLessonInstructions("");
      setNewLessonDueDate("");
      toast({ title: "Lesson created successfully" });
    },
  });

  const addFeedbackMutation = useMutation({
    mutationFn: async (data: { evidenceId: number; feedback: string; grade?: string }) => {
      return apiRequest("POST", `/api/portfolio/evidence/${data.evidenceId}/feedback`, { 
        feedback: data.feedback, 
        grade: data.grade 
      });
    },
    onSuccess: () => {
      refetchSubmissions();
      setShowFeedbackDialog(false);
      setFeedbackText("");
      setFeedbackGrade("");
      toast({ title: "Feedback added" });
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: async (evidenceId: number) => {
      return apiRequest("PATCH", `/api/portfolio/evidence/${evidenceId}`, { reviewStatus: "approved" });
    },
    onSuccess: () => {
      refetchSubmissions();
      toast({ title: "Marked as reviewed" });
    },
  });

  const roleColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-amber-500/10 text-amber-600 border-amber-200";
      case "teacher": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "parent": return "bg-green-500/10 text-green-600 border-green-200";
      default: return "";
    }
  };

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Co-ops & Organizations</h1>
          <p className="text-muted-foreground">Manage homeschool co-ops, teachers, and classes</p>
        </div>
        <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-org">
              <Plus className="h-4 w-4 mr-2" />
              Create Co-op
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Co-op</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Co-op Name</Label>
                <Input 
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g., Mountain View Homeschool Co-op"
                  data-testid="input-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input 
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  placeholder="Brief description of your co-op"
                  data-testid="input-org-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={() => createOrgMutation.mutate({ name: newOrgName, description: newOrgDescription })}
                disabled={!newOrgName || createOrgMutation.isPending}
                data-testid="button-submit-create-org"
              >
                {createOrgMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Co-op
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Co-ops Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a co-op to manage teachers, parents, and classes together
            </p>
            <Button onClick={() => setShowCreateOrgDialog(true)} data-testid="button-create-first-org">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Co-op
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Your Co-ops</h3>
            {organizations.map((org) => (
              <Card 
                key={org.id}
                className={`cursor-pointer transition-all hover-elevate ${selectedOrg?.id === org.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedOrg(org)}
                data-testid={`card-org-${org.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{org.name}</p>
                      {org.userRole && (
                        <Badge variant="outline" className={`text-xs ${roleColor(org.userRole)}`}>
                          {org.userRole}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedOrg && (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedOrg.name}</CardTitle>
                      <CardDescription>{selectedOrg.description || "No description"}</CardDescription>
                    </div>
                    {orgDetails?.userRole === "owner" && (
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="members">
                    <TabsList className="mb-4">
                      <TabsTrigger value="members" data-testid="tab-members">
                        <Users className="h-4 w-4 mr-2" />
                        Members
                      </TabsTrigger>
                      <TabsTrigger value="classes" data-testid="tab-classes">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Classes
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="members" className="space-y-4">
                      {orgDetails?.userRole === "owner" && (
                        <Button variant="outline" onClick={() => setShowInviteDialog(true)} data-testid="button-invite-member">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite Member
                        </Button>
                      )}
                      
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {member.user?.firstName} {member.user?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={roleColor(member.role)}>
                                {member.role}
                              </Badge>
                              <Badge variant="outline" className={member.status === "active" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}>
                                {member.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="classes" className="space-y-4">
                      {(orgDetails?.userRole === "owner" || orgDetails?.userRole === "teacher") && (
                        <Dialog open={showCreateClassDialog} onOpenChange={setShowCreateClassDialog}>
                          <DialogTrigger asChild>
                            <Button variant="outline" data-testid="button-create-class">
                              <GraduationCap className="h-4 w-4 mr-2" />
                              Create Class
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create New Class</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Class Name</Label>
                                <Input 
                                  value={newClassName}
                                  onChange={(e) => setNewClassName(e.target.value)}
                                  placeholder="e.g., History Co-op - Middle School"
                                  data-testid="input-class-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Input 
                                  value={newClassDescription}
                                  onChange={(e) => setNewClassDescription(e.target.value)}
                                  placeholder="What topics will this class cover?"
                                  data-testid="input-class-description"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                onClick={() => createClassMutation.mutate({ name: newClassName, description: newClassDescription })}
                                disabled={!newClassName || createClassMutation.isPending}
                                data-testid="button-submit-create-class"
                              >
                                {createClassMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Create Class
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}

                      <div className="grid md:grid-cols-2 gap-3">
                        {classes.map((cls) => (
                          <Card 
                            key={cls.id} 
                            className={`cursor-pointer hover-elevate ${selectedClassId === cls.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedClassId(cls.id)}
                            data-testid={`card-class-${cls.id}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                                  <GraduationCap className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{cls.name}</p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {cls.description || "No description"}
                                  </p>
                                </div>
                                <Badge variant={cls.isActive ? "default" : "secondary"}>
                                  {cls.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {classes.length === 0 && (
                          <div className="col-span-2 text-center py-8 text-muted-foreground">
                            No classes yet. Create a class to start teaching.
                          </div>
                        )}
                      </div>

                      {selectedClassId && (
                        <div className="mt-4 p-4 border rounded-lg">
                          <Tabs value={classTab} onValueChange={(v) => setClassTab(v as "students" | "lessons")}>
                            <TabsList className="mb-4">
                              <TabsTrigger value="lessons" data-testid="tab-class-lessons">
                                <FileText className="h-4 w-4 mr-2" />
                                Lessons
                              </TabsTrigger>
                              <TabsTrigger value="students" data-testid="tab-class-students">
                                <Users className="h-4 w-4 mr-2" />
                                Students
                              </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="lessons" className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">
                                  Assignments
                                  <Badge variant="secondary" className="ml-2">{classLessons.length}</Badge>
                                </h4>
                                <Dialog open={showCreateLessonDialog} onOpenChange={setShowCreateLessonDialog}>
                                  <DialogTrigger asChild>
                                    <Button size="sm" data-testid="button-create-lesson">
                                      <Plus className="h-4 w-4 mr-2" />
                                      New Assignment
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                      <DialogTitle>Create New Assignment</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input 
                                          value={newLessonTitle}
                                          onChange={(e) => setNewLessonTitle(e.target.value)}
                                          placeholder="e.g., Week 1: American Revolution"
                                          data-testid="input-lesson-title"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Description (optional)</Label>
                                        <Textarea 
                                          value={newLessonDescription}
                                          onChange={(e) => setNewLessonDescription(e.target.value)}
                                          placeholder="Brief overview of this assignment"
                                          data-testid="input-lesson-description"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Instructions - What to Submit</Label>
                                        <Textarea 
                                          value={newLessonInstructions}
                                          onChange={(e) => setNewLessonInstructions(e.target.value)}
                                          placeholder="e.g., Read chapter 3 and complete the worksheet. Upload a photo of your completed work."
                                          className="min-h-[100px]"
                                          data-testid="input-lesson-instructions"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Due Date (optional)</Label>
                                        <Input 
                                          type="date"
                                          value={newLessonDueDate}
                                          onChange={(e) => setNewLessonDueDate(e.target.value)}
                                          data-testid="input-lesson-due-date"
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button 
                                        onClick={() => createLessonMutation.mutate({ 
                                          title: newLessonTitle, 
                                          description: newLessonDescription || undefined,
                                          instructions: newLessonInstructions || undefined,
                                          dueDate: newLessonDueDate || undefined
                                        })}
                                        disabled={!newLessonTitle || createLessonMutation.isPending}
                                        data-testid="button-submit-create-lesson"
                                      >
                                        {createLessonMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Create Assignment
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                              
                              <div className="space-y-2">
                                {classLessons.map((lesson) => (
                                  <div key={lesson.id} className="p-3 rounded-lg border hover-elevate">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium">{lesson.title}</p>
                                        {lesson.description && (
                                          <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>
                                        )}
                                        {lesson.instructions && (
                                          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                                            <p className="font-medium text-xs text-muted-foreground mb-1">Instructions:</p>
                                            <p>{lesson.instructions}</p>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                          {lesson.dueDate && (
                                            <span className="flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              Due: {format(new Date(lesson.dueDate), "MMM d, yyyy")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedLessonId(lesson.id);
                                          setShowSubmissionsDialog(true);
                                        }}
                                        data-testid={`button-view-submissions-${lesson.id}`}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Submissions
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {classLessons.length === 0 && (
                                  <p className="text-center py-8 text-muted-foreground">
                                    No assignments yet. Create your first assignment to get started.
                                  </p>
                                )}
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="students" className="space-y-4">
                              <h4 className="font-medium">
                                Enrolled Students
                                <Badge variant="secondary" className="ml-2">
                                  {classEnrollments.filter(e => e.status === "active").length}
                                </Badge>
                              </h4>
                              <div className="space-y-2">
                                {classEnrollments.filter(e => e.status === "active").map((enrollment) => (
                                  <div key={enrollment.id} className="flex items-center gap-2 p-2 rounded border">
                                    <div 
                                      className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                                      style={{ backgroundColor: enrollment.student.color || "#6B7280" }}
                                    >
                                      {enrollment.student.name.charAt(0)}
                                    </div>
                                    <span>{enrollment.student.name}</span>
                                  </div>
                                ))}
                                {classEnrollments.filter(e => e.status === "active").length === 0 && (
                                  <p className="text-sm text-muted-foreground">No students enrolled yet</p>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Submissions Dialog */}
      <Dialog open={showSubmissionsDialog} onOpenChange={setShowSubmissionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Submissions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {submissions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No submissions yet for this assignment.
              </p>
            ) : (
              submissions.map((sub) => (
                <Card key={sub.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{sub.studentName}</p>
                          <Badge variant={sub.reviewStatus === "approved" ? "default" : "secondary"}>
                            {sub.reviewStatus === "approved" ? "Reviewed" : "Pending"}
                          </Badge>
                        </div>
                        {sub.fileType.startsWith("image") && (
                          <img 
                            src={sub.fileUrl} 
                            alt={sub.title || "Submission"} 
                            className="max-w-full h-auto max-h-48 rounded border object-contain"
                          />
                        )}
                        {!sub.fileType.startsWith("image") && (
                          <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            View File
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted: {format(new Date(sub.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        
                        {sub.feedback && sub.feedback.length > 0 && (
                          <div className="mt-3 p-3 bg-muted/50 rounded">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Your Feedback:</p>
                            {sub.feedback.map((f) => (
                              <div key={f.id}>
                                <p className="text-sm">{f.feedback}</p>
                                {f.grade && <p className="text-xs text-muted-foreground mt-1">Grade: {f.grade}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {sub.reviewStatus !== "approved" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => markReviewedMutation.mutate(sub.id)}
                            disabled={markReviewedMutation.isPending}
                            data-testid={`button-mark-reviewed-${sub.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Reviewed
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setShowFeedbackDialog(true);
                          }}
                          data-testid={`button-add-feedback-${sub.id}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          {sub.feedback?.length ? "Edit Feedback" : "Add Feedback"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Feedback for {selectedSubmission?.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feedback / Comments</Label>
              <Textarea 
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Great work! I can see you put a lot of effort into this..."
                className="min-h-[100px]"
                data-testid="input-feedback-text"
              />
            </div>
            <div className="space-y-2">
              <Label>Grade (optional)</Label>
              <Input 
                value={feedbackGrade}
                onChange={(e) => setFeedbackGrade(e.target.value)}
                placeholder="e.g., A, 95%, Complete"
                data-testid="input-feedback-grade"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                if (selectedSubmission) {
                  addFeedbackMutation.mutate({
                    evidenceId: selectedSubmission.id,
                    feedback: feedbackText,
                    grade: feedbackGrade || undefined
                  });
                }
              }}
              disabled={!feedbackText || addFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {addFeedbackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
