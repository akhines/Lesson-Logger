import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, Save, ArrowLeft, Type, BookOpen, GraduationCap, 
  Users, Shield, KeyRound, Lock, ShieldAlert
} from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SiteSetting, User, Student } from "@shared/schema";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_SETTINGS = {
  siteName: "Sunwoven Homeschool",
  welcomeMessage: "Welcome to your learning portal!",
  studentPortalTitle: "My Learning Portal",
  parentDashboardTitle: "Homeschool Dashboard",
  schedulePageTitle: "Weekly Schedule",
  subjectsPageTitle: "Subjects & Curriculum",
  mathFactsTitle: "Math Facts Practice",
  reportsTitle: "Reports & Attendance",
  customFooterText: "",
};

type SettingKey = keyof typeof DEFAULT_SETTINGS;

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const { data: savedSettings, isLoading: settingsLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings"],
    enabled: adminCheck?.isAdmin === true,
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: adminCheck?.isAdmin === true,
  });

  const { data: allStudents, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/admin/students"],
    enabled: adminCheck?.isAdmin === true,
  });

  useEffect(() => {
    if (savedSettings) {
      const loadedSettings = { ...DEFAULT_SETTINGS };
      savedSettings.forEach(setting => {
        if (setting.key in loadedSettings && setting.value !== null) {
          (loadedSettings as any)[setting.key] = setting.value;
        }
      });
      setSettings(loadedSettings);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (settingsToSave: typeof settings) => {
      const settingsArray = Object.entries(settingsToSave).map(([key, value]) => ({
        key,
        value: value || null,
      }));
      return apiRequest("PUT", "/api/site-settings", { settings: settingsArray });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      setHasChanges(false);
      toast({ title: "Settings saved!", description: "Your changes have been applied." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: async ({ studentId, pin }: { studentId: number; pin: string | null }) => {
      return apiRequest("PATCH", `/api/admin/students/${studentId}/pin`, { pin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setPinDialogOpen(false);
      setSelectedStudent(null);
      setNewPin("");
      toast({ 
        title: "PIN Updated", 
        description: newPin ? "Student PIN has been changed." : "Student PIN has been removed." 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update PIN.", 
        variant: "destructive" 
      });
    },
  });

  const updateSetting = (key: SettingKey, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleResetPin = () => {
    if (selectedStudent) {
      if (newPin && (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin))) {
        toast({ title: "Invalid PIN", description: "PIN must be 4-6 digits.", variant: "destructive" });
        return;
      }
      resetPinMutation.mutate({ studentId: selectedStudent.id, pin: newPin || null });
    }
  };

  const openPinDialog = (student: Student) => {
    setSelectedStudent(student);
    setNewPin("");
    setPinDialogOpen(true);
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-destructive/10">
        <Card className="max-w-md mx-4">
          <CardHeader className="text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              This page is only accessible to administrators. If you believe you should have access, 
              please contact the site owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button data-testid="button-go-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = settingsLoading || usersLoading || studentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading admin settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Admin Settings
              </h1>
              <p className="text-muted-foreground">Manage sitewide settings and users</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-primary border-primary">
            <Shield className="h-3 w-3" />
            Administrator
          </Badge>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              Site Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Parent Users
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2" data-testid="tab-students">
              <GraduationCap className="h-4 w-4" />
              Students & PINs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || saveMutation.isPending}
                className="gap-2"
                data-testid="button-save-settings"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Branding
                </CardTitle>
                <CardDescription>Customize your site name and welcome messages (applies to all users)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={settings.siteName}
                    onChange={(e) => updateSetting("siteName", e.target.value)}
                    placeholder="Your Homeschool Name"
                    data-testid="input-site-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={settings.welcomeMessage}
                    onChange={(e) => updateSetting("welcomeMessage", e.target.value)}
                    placeholder="A friendly welcome message for students"
                    rows={2}
                    data-testid="input-welcome-message"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customFooterText">Custom Footer Text</Label>
                  <Input
                    id="customFooterText"
                    value={settings.customFooterText}
                    onChange={(e) => updateSetting("customFooterText", e.target.value)}
                    placeholder="Optional footer text"
                    data-testid="input-footer-text"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Student Portal
                </CardTitle>
                <CardDescription>Customize the student-facing portal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studentPortalTitle">Portal Title</Label>
                  <Input
                    id="studentPortalTitle"
                    value={settings.studentPortalTitle}
                    onChange={(e) => updateSetting("studentPortalTitle", e.target.value)}
                    placeholder="My Learning Portal"
                    data-testid="input-student-portal-title"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Page Titles
                </CardTitle>
                <CardDescription>Customize titles for different sections</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="parentDashboardTitle">Dashboard Title</Label>
                  <Input
                    id="parentDashboardTitle"
                    value={settings.parentDashboardTitle}
                    onChange={(e) => updateSetting("parentDashboardTitle", e.target.value)}
                    placeholder="Homeschool Dashboard"
                    data-testid="input-dashboard-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedulePageTitle">Schedule Page Title</Label>
                  <Input
                    id="schedulePageTitle"
                    value={settings.schedulePageTitle}
                    onChange={(e) => updateSetting("schedulePageTitle", e.target.value)}
                    placeholder="Weekly Schedule"
                    data-testid="input-schedule-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subjectsPageTitle">Subjects Page Title</Label>
                  <Input
                    id="subjectsPageTitle"
                    value={settings.subjectsPageTitle}
                    onChange={(e) => updateSetting("subjectsPageTitle", e.target.value)}
                    placeholder="Subjects & Curriculum"
                    data-testid="input-subjects-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mathFactsTitle">Math Facts Title</Label>
                  <Input
                    id="mathFactsTitle"
                    value={settings.mathFactsTitle}
                    onChange={(e) => updateSetting("mathFactsTitle", e.target.value)}
                    placeholder="Math Facts Practice"
                    data-testid="input-mathfacts-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportsTitle">Reports Title</Label>
                  <Input
                    id="reportsTitle"
                    value={settings.reportsTitle}
                    onChange={(e) => updateSetting("reportsTitle", e.target.value)}
                    placeholder="Reports & Attendance"
                    data-testid="input-reports-title"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Registered Users
                </CardTitle>
                <CardDescription>View all parent/teacher accounts</CardDescription>
              </CardHeader>
              <CardContent>
                {allUsers && allUsers.length > 0 ? (
                  <div className="space-y-3">
                    {allUsers.map((user) => (
                      <div 
                        key={user.id} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        data-testid={`user-row-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.profileImageUrl || undefined} />
                            <AvatarFallback>
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.isAdmin && (
                            <Badge className="gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No users found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Student PIN Management
                </CardTitle>
                <CardDescription>View all students and reset their login PINs</CardDescription>
              </CardHeader>
              <CardContent>
                {allStudents && allStudents.length > 0 ? (
                  <div className="space-y-3">
                    {allStudents.map((student) => (
                      <div 
                        key={student.id} 
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        data-testid={`student-row-${student.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: student.color || "#6B7280" }}
                          >
                            {student.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Grade {student.gradeLevel} 
                              {student.pin ? " • PIN Set" : " • No PIN"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {student.pin ? (
                            <Badge variant="outline" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Protected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-muted-foreground">
                              No PIN
                            </Badge>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openPinDialog(student)}
                            data-testid={`button-reset-pin-${student.id}`}
                          >
                            <KeyRound className="h-4 w-4 mr-1" />
                            {student.pin ? "Reset PIN" : "Set PIN"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No students found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedStudent?.pin ? "Reset" : "Set"} PIN for {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription>
                Enter a new 4-6 digit PIN for this student, or leave empty to remove the PIN.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-pin">New PIN (4-6 digits)</Label>
                <Input
                  id="new-pin"
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter new PIN or leave empty to remove"
                  maxLength={6}
                  data-testid="input-new-pin"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to remove PIN protection
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setPinDialogOpen(false)}
                data-testid="button-cancel-pin"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleResetPin}
                disabled={resetPinMutation.isPending}
                data-testid="button-confirm-pin"
              >
                {resetPinMutation.isPending ? "Saving..." : newPin ? "Set PIN" : "Remove PIN"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
