import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Save, ArrowLeft, Type, MessageSquare, BookOpen, GraduationCap } from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SiteSetting } from "@shared/schema";

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

  const { data: savedSettings, isLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings"],
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

  const updateSetting = (key: SettingKey, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                <Settings className="h-8 w-8 text-primary" />
                Site Settings
              </h1>
              <p className="text-muted-foreground">Customize your homeschool portal</p>
            </div>
          </div>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>Customize your site name and welcome messages</CardDescription>
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

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Coming Soon
              </CardTitle>
              <CardDescription>Additional customization options planned for future updates</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Custom color themes</li>
                <li>Logo upload</li>
                <li>Custom menu items</li>
                <li>Notification preferences</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
