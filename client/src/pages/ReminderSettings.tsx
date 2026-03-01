import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, Clock, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";

interface ReminderSettingsData {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;
  timezone: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "America/Indiana/Indianapolis",
  "America/Detroit",
  "America/Boise",
  "America/Kentucky/Louisville",
  "America/North_Dakota/Center",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTimezone(tz: string): string {
  return tz.replace(/_/g, " ").replace(/\//g, " / ");
}

export default function ReminderSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<ReminderSettingsData>({
    queryKey: ["/api/reminders/settings"],
  });

  const [form, setForm] = useState<ReminderSettingsData>({
    dailyReminderEnabled: false,
    dailyReminderTime: "18:00",
    weeklySummaryEnabled: false,
    weeklySummaryDay: 0,
    weeklySummaryTime: "09:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        dailyReminderEnabled: settings.dailyReminderEnabled,
        dailyReminderTime: settings.dailyReminderTime || "18:00",
        weeklySummaryEnabled: settings.weeklySummaryEnabled,
        weeklySummaryDay: settings.weeklySummaryDay ?? 0,
        weeklySummaryTime: settings.weeklySummaryTime || "09:00",
        timezone: settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: ReminderSettingsData) => {
      const res = await apiRequest("PUT", "/api/reminders/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/settings"] });
      toast({ title: "Saved", description: "Your reminder preferences have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleChange(field: keyof ReminderSettingsData, value: any) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    saveMutation.mutate(updated);
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="h-12 bg-muted/20 animate-pulse rounded-xl w-1/3" />
          <div className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
          <div className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display" data-testid="text-reminder-settings-title">Reminders</h1>
            <p className="text-muted-foreground text-sm">Choose when you'd like a friendly nudge to log learning.</p>
          </div>
        </div>

        <Card data-testid="card-timezone">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Your Timezone</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Select value={form.timezone} onValueChange={v => handleChange("timezone", v)}>
              <SelectTrigger data-testid="select-timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>{formatTimezone(tz)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card data-testid="card-daily-reminder">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Daily Reminder</CardTitle>
              </div>
              <Switch
                checked={form.dailyReminderEnabled}
                onCheckedChange={v => handleChange("dailyReminderEnabled", v)}
                data-testid="switch-daily-reminder"
              />
            </div>
            <CardDescription>
              Get a gentle nudge if you haven't logged today. We'll only send it once, and only if there are no logs for the day.
            </CardDescription>
          </CardHeader>
          {form.dailyReminderEnabled && (
            <CardContent>
              <div className="space-y-2">
                <Label>Reminder time</Label>
                <Select value={form.dailyReminderTime} onValueChange={v => handleChange("dailyReminderTime", v)}>
                  <SelectTrigger data-testid="select-daily-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">We'll check if you've logged by this time. If not, you'll get a short email.</p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card data-testid="card-weekly-summary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Weekly Summary</CardTitle>
              </div>
              <Switch
                checked={form.weeklySummaryEnabled}
                onCheckedChange={v => handleChange("weeklySummaryEnabled", v)}
                data-testid="switch-weekly-summary"
              />
            </div>
            <CardDescription>
              Receive a weekly snapshot of your family's logged learning — total time, lessons, and subjects covered.
            </CardDescription>
          </CardHeader>
          {form.weeklySummaryEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select value={String(form.weeklySummaryDay)} onValueChange={v => handleChange("weeklySummaryDay", Number(v))}>
                  <SelectTrigger data-testid="select-weekly-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day, i) => (
                      <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select value={form.weeklySummaryTime} onValueChange={v => handleChange("weeklySummaryTime", v)}>
                  <SelectTrigger data-testid="select-weekly-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{formatTime(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
