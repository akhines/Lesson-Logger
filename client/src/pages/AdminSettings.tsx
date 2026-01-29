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
  Users, Shield, KeyRound, Lock, ShieldAlert, Globe, Sparkles,
  Trash2, UserCheck, ExternalLink, AlertTriangle, LayoutDashboard
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
  // Menu item labels
  menuDashboard: "Dashboard",
  menuStudents: "Students",
  menuSchedule: "Schedule",
  menuSubjects: "Subjects",
  menuLibrary: "Library",
  menuCurriculum: "Curriculum",
  menuAssistant: "My Assistant",
  menuCopywork: "Copywork Generator",
  menuMathFacts: "Math Facts",
  menuGrammar: "Grammar Practice",
  menuPortfolio: "Portfolio",
  menuReports: "Reports",
  menuSettings: "Site Settings",
  // Website settings
  heroHeadline: "Homeschooling Made Simple",
  heroSubheadline: "Manage lessons, track assignments, and organize your curriculum in one beautiful dashboard. Focus on teaching, not planning.",
  heroPrimaryButton: "Get Started Free",
  heroSecondaryButton: "View Demo",
  featuresHeadline: "Everything you need to succeed",
  featuresSubheadline: "Built specifically for homeschool educators and students to stay on track.",
  feature1Title: "Flexible Scheduling",
  feature1Description: "Drag-and-drop lesson planning that adapts to your life, not the other way around.",
  feature2Title: "Curriculum Tracking",
  feature2Description: "Manage multiple subjects and track progress across the entire school year.",
  feature3Title: "Assignment Management",
  feature3Description: "Create assignments, accept uploads, and grade work all in one place.",
  footerText: "© 2024 Sunwoven Homeschool. All rights reserved.",
};

type SettingKey = keyof typeof DEFAULT_SETTINGS;

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({ title: "User Deleted", description: "The user account has been removed." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to delete user.", 
        variant: "destructive" 
      });
    },
  });

  const impersonateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/impersonate/${userId}`);
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Now Impersonating", 
        description: data.message || "You are now viewing as this user." 
      });
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to impersonate user.", 
        variant: "destructive" 
      });
    },
  });

  const impersonateStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const res = await apiRequest("POST", `/api/admin/impersonate-student/${studentId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      // Store the student impersonation token and redirect to student portal
      sessionStorage.setItem("adminStudentToken", data.token);
      sessionStorage.setItem("adminStudentId", String(data.student.id));
      sessionStorage.setItem("adminStudentName", data.student.name);
      toast({ 
        title: "Student Portal Access", 
        description: `Opening student portal as ${data.student.name}` 
      });
      window.open(`/student-portal?admin_token=${data.token}`, "_blank");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to access student portal.", 
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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="website" className="gap-2" data-testid="tab-website">
              <Globe className="h-4 w-4" />
              Website
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              App Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2" data-testid="tab-students">
              <GraduationCap className="h-4 w-4" />
              Students & PINs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="website" className="space-y-6">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline"
                asChild
                className="gap-2"
                data-testid="button-homepage-builder"
              >
                <a href="/homepage-builder">
                  <LayoutDashboard className="h-4 w-4" />
                  Homepage Builder
                </a>
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || saveMutation.isPending}
                className="gap-2"
                data-testid="button-save-website"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Hero Section
                </CardTitle>
                <CardDescription>Edit the main headline and call-to-action on your landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="heroHeadline">Headline</Label>
                  <Input
                    id="heroHeadline"
                    value={settings.heroHeadline}
                    onChange={(e) => updateSetting("heroHeadline", e.target.value)}
                    placeholder="Homeschooling Made Simple"
                    data-testid="input-hero-headline"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroSubheadline">Subheadline</Label>
                  <Textarea
                    id="heroSubheadline"
                    value={settings.heroSubheadline}
                    onChange={(e) => updateSetting("heroSubheadline", e.target.value)}
                    placeholder="A description of what your homeschool offers"
                    rows={3}
                    data-testid="input-hero-subheadline"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="heroPrimaryButton">Primary Button Text</Label>
                    <Input
                      id="heroPrimaryButton"
                      value={settings.heroPrimaryButton}
                      onChange={(e) => updateSetting("heroPrimaryButton", e.target.value)}
                      placeholder="Get Started Free"
                      data-testid="input-hero-primary-button"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroSecondaryButton">Secondary Button Text</Label>
                    <Input
                      id="heroSecondaryButton"
                      value={settings.heroSecondaryButton}
                      onChange={(e) => updateSetting("heroSecondaryButton", e.target.value)}
                      placeholder="View Demo"
                      data-testid="input-hero-secondary-button"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Features Section
                </CardTitle>
                <CardDescription>Edit the features displayed on your landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="featuresHeadline">Section Headline</Label>
                    <Input
                      id="featuresHeadline"
                      value={settings.featuresHeadline}
                      onChange={(e) => updateSetting("featuresHeadline", e.target.value)}
                      placeholder="Everything you need to succeed"
                      data-testid="input-features-headline"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="featuresSubheadline">Section Subheadline</Label>
                    <Input
                      id="featuresSubheadline"
                      value={settings.featuresSubheadline}
                      onChange={(e) => updateSetting("featuresSubheadline", e.target.value)}
                      placeholder="Built for homeschool educators"
                      data-testid="input-features-subheadline"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Feature 1</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="feature1Title">Title</Label>
                      <Input
                        id="feature1Title"
                        value={settings.feature1Title}
                        onChange={(e) => updateSetting("feature1Title", e.target.value)}
                        placeholder="Flexible Scheduling"
                        data-testid="input-feature1-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature1Description">Description</Label>
                      <Input
                        id="feature1Description"
                        value={settings.feature1Description}
                        onChange={(e) => updateSetting("feature1Description", e.target.value)}
                        placeholder="Feature description"
                        data-testid="input-feature1-description"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Feature 2</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="feature2Title">Title</Label>
                      <Input
                        id="feature2Title"
                        value={settings.feature2Title}
                        onChange={(e) => updateSetting("feature2Title", e.target.value)}
                        placeholder="Curriculum Tracking"
                        data-testid="input-feature2-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature2Description">Description</Label>
                      <Input
                        id="feature2Description"
                        value={settings.feature2Description}
                        onChange={(e) => updateSetting("feature2Description", e.target.value)}
                        placeholder="Feature description"
                        data-testid="input-feature2-description"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Feature 3</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="feature3Title">Title</Label>
                      <Input
                        id="feature3Title"
                        value={settings.feature3Title}
                        onChange={(e) => updateSetting("feature3Title", e.target.value)}
                        placeholder="Assignment Management"
                        data-testid="input-feature3-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature3Description">Description</Label>
                      <Input
                        id="feature3Description"
                        value={settings.feature3Description}
                        onChange={(e) => updateSetting("feature3Description", e.target.value)}
                        placeholder="Feature description"
                        data-testid="input-feature3-description"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Footer
                </CardTitle>
                <CardDescription>Edit the footer text on your landing page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={settings.footerText}
                    onChange={(e) => updateSetting("footerText", e.target.value)}
                    placeholder="© 2024 Your Homeschool. All rights reserved."
                    data-testid="input-footer-text"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Menu Names
                </CardTitle>
                <CardDescription>Customize the names of menu items in the sidebar navigation</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="menuDashboard">Dashboard</Label>
                  <Input
                    id="menuDashboard"
                    value={settings.menuDashboard}
                    onChange={(e) => updateSetting("menuDashboard", e.target.value)}
                    placeholder="Dashboard"
                    data-testid="input-menu-dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuStudents">Students</Label>
                  <Input
                    id="menuStudents"
                    value={settings.menuStudents}
                    onChange={(e) => updateSetting("menuStudents", e.target.value)}
                    placeholder="Students"
                    data-testid="input-menu-students"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuSchedule">Schedule</Label>
                  <Input
                    id="menuSchedule"
                    value={settings.menuSchedule}
                    onChange={(e) => updateSetting("menuSchedule", e.target.value)}
                    placeholder="Schedule"
                    data-testid="input-menu-schedule"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuSubjects">Subjects</Label>
                  <Input
                    id="menuSubjects"
                    value={settings.menuSubjects}
                    onChange={(e) => updateSetting("menuSubjects", e.target.value)}
                    placeholder="Subjects"
                    data-testid="input-menu-subjects"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuLibrary">Library</Label>
                  <Input
                    id="menuLibrary"
                    value={settings.menuLibrary}
                    onChange={(e) => updateSetting("menuLibrary", e.target.value)}
                    placeholder="Library"
                    data-testid="input-menu-library"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuCurriculum">Curriculum</Label>
                  <Input
                    id="menuCurriculum"
                    value={settings.menuCurriculum}
                    onChange={(e) => updateSetting("menuCurriculum", e.target.value)}
                    placeholder="Curriculum"
                    data-testid="input-menu-curriculum"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuAssistant">My Assistant</Label>
                  <Input
                    id="menuAssistant"
                    value={settings.menuAssistant}
                    onChange={(e) => updateSetting("menuAssistant", e.target.value)}
                    placeholder="My Assistant"
                    data-testid="input-menu-assistant"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuCopywork">Copywork Generator</Label>
                  <Input
                    id="menuCopywork"
                    value={settings.menuCopywork}
                    onChange={(e) => updateSetting("menuCopywork", e.target.value)}
                    placeholder="Copywork Generator"
                    data-testid="input-menu-copywork"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuMathFacts">Math Facts</Label>
                  <Input
                    id="menuMathFacts"
                    value={settings.menuMathFacts}
                    onChange={(e) => updateSetting("menuMathFacts", e.target.value)}
                    placeholder="Math Facts"
                    data-testid="input-menu-mathfacts"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuGrammar">Grammar Practice</Label>
                  <Input
                    id="menuGrammar"
                    value={settings.menuGrammar}
                    onChange={(e) => updateSetting("menuGrammar", e.target.value)}
                    placeholder="Grammar Practice"
                    data-testid="input-menu-grammar"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuPortfolio">Portfolio</Label>
                  <Input
                    id="menuPortfolio"
                    value={settings.menuPortfolio}
                    onChange={(e) => updateSetting("menuPortfolio", e.target.value)}
                    placeholder="Portfolio"
                    data-testid="input-menu-portfolio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuReports">Reports</Label>
                  <Input
                    id="menuReports"
                    value={settings.menuReports}
                    onChange={(e) => updateSetting("menuReports", e.target.value)}
                    placeholder="Reports"
                    data-testid="input-menu-reports"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menuSettings">Site Settings</Label>
                  <Input
                    id="menuSettings"
                    value={settings.menuSettings}
                    onChange={(e) => updateSetting("menuSettings", e.target.value)}
                    placeholder="Site Settings"
                    data-testid="input-menu-settings"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {/* Quick Access Test Accounts for Co-op Testing */}
            <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Test Accounts (Co-op Demo)
                </CardTitle>
                <CardDescription>Quick login buttons for testing different user roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Site Admin (Ashley) */}
                  <div className="flex flex-col gap-3 p-4 rounded-lg border-2 border-purple-300 bg-purple-50 dark:bg-purple-950/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-purple-200 text-purple-700">AH</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Ashley Hines</p>
                        <p className="text-xs text-muted-foreground">ashley@test.com</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-purple-600 text-xs">Site Admin</Badge>
                      <Badge variant="secondary" className="text-xs">Co-op Owner</Badge>
                    </div>
                    <Badge variant="outline" className="w-fit">Current User</Badge>
                  </div>

                  {/* Co-op Owner (Sarah) - NOT a site admin */}
                  <div className="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-100 text-green-700">SM</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Sarah Mitchell</p>
                        <p className="text-xs text-muted-foreground">coopowner@test.com</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">Co-op Owner</Badge>
                      <Badge variant="outline" className="text-xs">Valley Learning Co-op</Badge>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 w-fit"
                      onClick={() => impersonateUserMutation.mutate("coop-owner-001")}
                      disabled={impersonateUserMutation.isPending}
                      data-testid="button-login-coop-owner"
                    >
                      <UserCheck className="h-3 w-3" />
                      Login As Co-op Owner
                    </Button>
                  </div>

                  {/* Teacher (Maria) */}
                  <div className="flex flex-col gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-100 text-blue-700">MJ</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Maria Johnson</p>
                        <p className="text-xs text-muted-foreground">teacher@test.com</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">Teacher</Badge>
                      <Badge variant="outline" className="text-xs">Art Exploration</Badge>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 w-fit"
                      onClick={() => impersonateUserMutation.mutate("teacher-001")}
                      disabled={impersonateUserMutation.isPending}
                      data-testid="button-login-teacher"
                    >
                      <UserCheck className="h-3 w-3" />
                      Login As Teacher
                    </Button>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground space-y-1">
                  <p><strong>Sunshine Homeschool Co-op:</strong> Ashley (owner) + Maria (teacher) - Nora enrolled in Art class</p>
                  <p><strong>Valley Learning Co-op:</strong> Sarah (owner) - No classes yet</p>
                </div>
              </CardContent>
            </Card>

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
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.isAdmin && (
                            <Badge className="gap-1">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                          </p>
                          {!user.isAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => impersonateUserMutation.mutate(user.id)}
                                disabled={impersonateUserMutation.isPending}
                                data-testid={`button-impersonate-${user.id}`}
                              >
                                <UserCheck className="h-3 w-3" />
                                Login As
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setUserToDelete(user);
                                  setDeleteDialogOpen(true);
                                }}
                                data-testid={`button-delete-${user.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            </>
                          )}
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
                        <div className="flex items-center gap-2 flex-wrap">
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
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => impersonateStudentMutation.mutate(student.id)}
                            disabled={impersonateStudentMutation.isPending}
                            data-testid={`button-login-as-student-${student.id}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Portal
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

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete User Account
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the account for <strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong>? 
                This action cannot be undone and will remove all their data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setUserToDelete(null);
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
