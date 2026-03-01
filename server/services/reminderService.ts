import { storage } from "../storage";
import { sendEmail } from "./emailService";
import type { ReminderSettings, User } from "@shared/schema";

function getUserLocalDate(timezone: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function getUserLocalTime(timezone: string): string {
  try {
    const now = new Date();
    const h = Number(now.toLocaleString("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }));
    const m = Number(now.toLocaleString("en-GB", { timeZone: timezone, minute: "2-digit" }));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getUserLocalDayOfWeek(timezone: string): number {
  try {
    const now = new Date();
    const dayStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return days[dayStr] ?? now.getDay();
  } catch {
    return new Date().getDay();
  }
}

function isSameDay(date: Date | null | undefined, dateStr: string): boolean {
  if (!date) return false;
  return date.toISOString().split("T")[0] === dateStr;
}

function isWithin30DaysActive(user: User): boolean {
  if (!user.updatedAt) return true;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return user.updatedAt >= thirtyDaysAgo;
}

function getDailyReminderEmailHtml(userName: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px;">
    <h2 style="color: #1a365d; margin-bottom: 8px;">Want to log today's learning?</h2>
  </div>
  <div style="background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <p>Hi ${userName},</p>
    <p>Even a quick note about what you covered today helps you see the bigger picture over time. It only takes a few seconds!</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/?openQuickLog=true" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Log Today</a>
    </div>
    <p style="text-align: center;">
      <a href="${appUrl}/" style="color: #6b7280; font-size: 14px; text-decoration: underline;">View Dashboard</a>
    </p>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
    You're receiving this because you opted in to daily reminders.<br>
    You can turn them off anytime in Settings.
  </p>
</body>
</html>`;
}

function getWeeklySummaryEmailHtml(
  userName: string,
  appUrl: string,
  stats: { totalMinutes: number; lessonCount: number; subjects: string[]; evidenceCount: number }
): string {
  const hours = Math.floor(stats.totalMinutes / 60);
  const mins = stats.totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const subjectList = stats.subjects.length > 0
    ? stats.subjects.map(s => `<li style="padding: 2px 0;">${s}</li>`).join("")
    : "<li>No subjects logged</li>";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 20px;">
    <h2 style="color: #1a365d; margin-bottom: 8px;">Your Week in Review</h2>
    <p style="color: #6b7280;">Here's a snapshot of your family's learning this week.</p>
  </div>
  <div style="background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <p>Hi ${userName},</p>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0;">
      <div style="flex: 1; min-width: 120px; background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
        <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${timeDisplay}</div>
        <div style="font-size: 12px; color: #6b7280;">Total Time</div>
      </div>
      <div style="flex: 1; min-width: 120px; background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
        <div style="font-size: 24px; font-weight: 700; color: #10b981;">${stats.lessonCount}</div>
        <div style="font-size: 12px; color: #6b7280;">Lessons</div>
      </div>
      <div style="flex: 1; min-width: 120px; background: white; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0;">
        <div style="font-size: 24px; font-weight: 700; color: #8b5cf6;">${stats.evidenceCount}</div>
        <div style="font-size: 12px; color: #6b7280;">Evidence</div>
      </div>
    </div>
    <h3 style="margin: 16px 0 8px; font-size: 14px; color: #374151;">Subjects Covered</h3>
    <ul style="margin: 0; padding-left: 20px; color: #4b5563;">${subjectList}</ul>
    <div style="text-align: center; margin: 24px 0 8px;">
      <a href="${appUrl}/portfolio" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Portfolio</a>
    </div>
  </div>
  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
    You're receiving this because you opted in to weekly summaries.<br>
    You can turn them off anytime in Settings.
  </p>
</body>
</html>`;
}

export async function runDailyReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
  const allSettings = await storage.getAllReminderSettings();
  let sent = 0, skipped = 0, errors = 0;

  const appUrl = process.env.REPLIT_DEPLOYMENT_URL
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : process.env.REPL_SLUG
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : "https://localhost:5000";

  for (const settings of allSettings) {
    if (!settings.dailyReminderEnabled) { skipped++; continue; }

    const tz = settings.timezone || "America/New_York";
    const todayStr = getUserLocalDate(tz);
    const currentTime = getUserLocalTime(tz);
    const targetTime = settings.dailyReminderTime || "18:00";

    if (timeToMinutes(currentTime) < timeToMinutes(targetTime)) { skipped++; continue; }

    if (isSameDay(settings.lastDailyReminderSentAt, todayStr)) { skipped++; continue; }

    const user = await storage.getUserById(settings.userId);
    if (!user || !user.email) { skipped++; continue; }

    if (!isWithin30DaysActive(user)) { skipped++; continue; }

    const logs = await storage.getLessonLogs(settings.userId, { startDate: todayStr, endDate: todayStr });
    if (logs.length > 0) { skipped++; continue; }

    try {
      const userName = user.firstName || "there";
      const success = await sendEmail({
        to: user.email,
        subject: "Want to log today's learning?",
        html: getDailyReminderEmailHtml(userName, appUrl),
      });
      if (success) {
        await storage.updateReminderSentAt(settings.id, "lastDailyReminderSentAt");
        sent++;
        console.log(`Daily reminder sent to ${user.email}`);
      } else {
        errors++;
      }
    } catch (err) {
      console.error(`Failed to send daily reminder to ${user.email}:`, err);
      errors++;
    }
  }

  return { sent, skipped, errors };
}

export async function runWeeklySummaries(): Promise<{ sent: number; skipped: number; errors: number }> {
  const allSettings = await storage.getAllReminderSettings();
  let sent = 0, skipped = 0, errors = 0;

  const appUrl = process.env.REPLIT_DEPLOYMENT_URL
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : process.env.REPL_SLUG
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : "https://localhost:5000";

  for (const settings of allSettings) {
    if (!settings.weeklySummaryEnabled) { skipped++; continue; }

    const tz = settings.timezone || "America/New_York";
    const todayStr = getUserLocalDate(tz);
    const currentTime = getUserLocalTime(tz);
    const currentDay = getUserLocalDayOfWeek(tz);
    const targetDay = settings.weeklySummaryDay ?? 0;
    const targetTime = settings.weeklySummaryTime || "09:00";

    if (currentDay !== targetDay) { skipped++; continue; }
    if (timeToMinutes(currentTime) < timeToMinutes(targetTime)) { skipped++; continue; }

    if (isSameDay(settings.lastWeeklySummarySentAt, todayStr)) { skipped++; continue; }

    const user = await storage.getUserById(settings.userId);
    if (!user || !user.email) { skipped++; continue; }

    if (!isWithin30DaysActive(user)) { skipped++; continue; }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const logs = await storage.getLessonLogs(settings.userId, { startDate: weekAgoStr, endDate: todayStr });

    if (logs.length === 0) { skipped++; continue; }

    const evidence = await storage.getEvidenceUploads(settings.userId, {});

    const totalMinutes = logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
    const subjects = [...new Set(logs.map(l => l.subjectName).filter(Boolean))];

    try {
      const userName = user.firstName || "there";
      const success = await sendEmail({
        to: user.email,
        subject: "Your Week in Review",
        html: getWeeklySummaryEmailHtml(userName, appUrl, {
          totalMinutes,
          lessonCount: logs.length,
          subjects: subjects as string[],
          evidenceCount: evidence.length,
        }),
      });
      if (success) {
        await storage.updateReminderSentAt(settings.id, "lastWeeklySummarySentAt");
        sent++;
        console.log(`Weekly summary sent to ${user.email}`);
      } else {
        errors++;
      }
    } catch (err) {
      console.error(`Failed to send weekly summary to ${user.email}:`, err);
      errors++;
    }
  }

  return { sent, skipped, errors };
}

export async function runAllReminders(): Promise<{ daily: { sent: number; skipped: number; errors: number }; weekly: { sent: number; skipped: number; errors: number } }> {
  const [daily, weekly] = await Promise.all([
    runDailyReminders(),
    runWeeklySummaries(),
  ]);
  console.log(`Reminders run — Daily: ${daily.sent} sent, ${daily.skipped} skipped, ${daily.errors} errors | Weekly: ${weekly.sent} sent, ${weekly.skipped} skipped, ${weekly.errors} errors`);
  return { daily, weekly };
}
