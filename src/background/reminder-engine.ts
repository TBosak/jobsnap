import { db } from "../db/db";
import { readAlertSettings } from "../storage/alert-settings";
import { listProfileIndex } from "../storage/profiles";
import type { JobFillEvent } from "../ui-shared/types.history";

interface ReminderNotification {
  id: string;
  title: string;
  message: string;
  type: "no-response" | "ghosting" | "daily-goal" | "thank-you";
  data?: Record<string, unknown>;
}

/**
 * Get profile name by ID, with caching
 */
let profileCache: Map<string, string> | null = null;
async function getProfileName(profileId: string | undefined): Promise<string> {
  if (!profileId) return "";

  // Build cache on first call
  if (!profileCache) {
    profileCache = new Map();
    const profiles = await listProfileIndex();
    for (const profile of profiles) {
      profileCache.set(profile.id, profile.name);
    }
  }

  return profileCache.get(profileId) || "";
}

/**
 * Check all alert conditions and return notifications to display
 */
export async function checkAlerts(): Promise<ReminderNotification[]> {
  const settings = await readAlertSettings();
  const notifications: ReminderNotification[] = [];

  // Check No Response Reminder
  if (settings.noResponseReminder.enabled) {
    const noResponseNotifs = await checkNoResponseReminders(
      settings.noResponseReminder.daysThreshold
    );
    notifications.push(...noResponseNotifs);
  }

  // Check Ghosting Detection
  if (settings.ghostingDetection.enabled) {
    const ghostingNotifs = await checkGhostingDetection(
      settings.ghostingDetection.daysThreshold
    );
    notifications.push(...ghostingNotifs);
  }

  // Check Daily Application Goal
  if (settings.dailyApplicationGoal.enabled) {
    const goalNotif = await checkDailyApplicationGoal(
      settings.dailyApplicationGoal.dailyGoal,
      settings.dailyApplicationGoal.weeklyGoal
    );
    if (goalNotif) {
      notifications.push(goalNotif);
    }
  }

  // Check Thank You Note Reminder
  if (settings.thankYouNoteReminder.enabled) {
    const thankYouNotifs = await checkThankYouNoteReminders(
      settings.thankYouNoteReminder.hoursAfter
    );
    notifications.push(...thankYouNotifs);
  }

  return notifications;
}

/**
 * Check for applications with no response after X days
 */
async function checkNoResponseReminders(
  daysThreshold: number
): Promise<ReminderNotification[]> {
  const notifications: ReminderNotification[] = [];
  const cutoffTime = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  // Get all applied applications
  const applications = await db.job_history
    .where("status")
    .equals("applied")
    .filter((event) => {
      // Check if application is older than threshold
      const appliedAt = event.milestones?.appliedAt || event.statusChangedAt;
      return appliedAt < cutoffTime;
    })
    .toArray();

  // Limit to 3 most recent to avoid overwhelming user
  const recentApps = applications
    .sort((a, b) => {
      const aTime = a.milestones?.appliedAt || a.statusChangedAt;
      const bTime = b.milestones?.appliedAt || b.statusChangedAt;
      return bTime - aTime;
    })
    .slice(0, 3);

  for (const app of recentApps) {
    const daysAgo = Math.floor(
      (Date.now() - (app.milestones?.appliedAt || app.statusChangedAt)) /
        (24 * 60 * 60 * 1000)
    );

    const profileName = await getProfileName(app.profileId);
    const profileSuffix = profileName ? ` (${profileName})` : "";

    notifications.push({
      id: `no-response-${app.id}`,
      title: "No Response Yet",
      message: `${daysAgo} days since applying to ${app.company || app.title || "this job"}${profileSuffix}. Consider following up?`,
      type: "no-response",
      data: { eventId: app.id, daysAgo, profileName },
    });
  }

  return notifications;
}

/**
 * Check for applications stuck in "interview" or awaiting response
 */
async function checkGhostingDetection(
  daysThreshold: number
): Promise<ReminderNotification[]> {
  const notifications: ReminderNotification[] = [];
  const cutoffTime = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  // Get applications in interview stage
  const applications = await db.job_history
    .where("status")
    .equals("interview")
    .filter((event) => event.statusChangedAt < cutoffTime)
    .toArray();

  // Limit to 3 most recent
  const recentApps = applications
    .sort((a, b) => b.statusChangedAt - a.statusChangedAt)
    .slice(0, 3);

  for (const app of recentApps) {
    const daysStuck = Math.floor(
      (Date.now() - app.statusChangedAt) / (24 * 60 * 60 * 1000)
    );

    const profileName = await getProfileName(app.profileId);
    const profileSuffix = profileName ? ` (${profileName})` : "";

    notifications.push({
      id: `ghosting-${app.id}`,
      title: "Interview Process Stalled?",
      message: `No update on ${app.company || app.title || "this application"}${profileSuffix} for ${daysStuck} days. Reach out or move on?`,
      type: "ghosting",
      data: { eventId: app.id, daysStuck, profileName },
    });
  }

  return notifications;
}

/**
 * Check if user has met their daily/weekly application goals
 * Note: Counts applications across ALL profiles to measure overall activity
 */
async function checkDailyApplicationGoal(
  dailyGoal: number,
  weeklyGoal: number
): Promise<ReminderNotification | null> {
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Count today's applications
  const todayApplications = await db.job_history
    .where("status")
    .equals("applied")
    .filter((event) => {
      const appliedAt = event.milestones?.appliedAt || event.statusChangedAt;
      return appliedAt >= todayStart;
    })
    .toArray();

  // Count this week's applications
  const weekApplications = await db.job_history
    .where("status")
    .equals("applied")
    .filter((event) => {
      const appliedAt = event.milestones?.appliedAt || event.statusChangedAt;
      return appliedAt >= weekAgo;
    })
    .toArray();

  const todayApps = todayApplications.length;
  const weekApps = weekApplications.length;

  // Get unique profile count for context
  const todayProfiles = new Set(todayApplications.map(app => app.profileId).filter(Boolean));
  const weekProfiles = new Set(weekApplications.map(app => app.profileId).filter(Boolean));

  // Check daily goal
  if (dailyGoal > 0 && todayApps < dailyGoal) {
    const remaining = dailyGoal - todayApps;
    const profileNote = todayProfiles.size > 1 ? ` across ${todayProfiles.size} profiles` : "";
    return {
      id: "daily-goal",
      title: "Daily Application Goal",
      message: `You've applied to ${todayApps}/${dailyGoal} jobs today${profileNote}. ${remaining} more to reach your goal!`,
      type: "daily-goal",
      data: { todayCount: todayApps, dailyGoal, remaining, profileCount: todayProfiles.size },
    };
  }

  // Check weekly goal
  if (weeklyGoal > 0 && weekApps < weeklyGoal) {
    const remaining = weeklyGoal - weekApps;
    const profileNote = weekProfiles.size > 1 ? ` across ${weekProfiles.size} profiles` : "";
    return {
      id: "weekly-goal",
      title: "Weekly Application Goal",
      message: `You've applied to ${weekApps}/${weeklyGoal} jobs this week${profileNote}. ${remaining} more to go!`,
      type: "daily-goal",
      data: { weekCount: weekApps, weeklyGoal, remaining, profileCount: weekProfiles.size },
    };
  }

  return null;
}

/**
 * Check for interviews that need thank-you notes
 */
async function checkThankYouNoteReminders(
  hoursAfter: number
): Promise<ReminderNotification[]> {
  const notifications: ReminderNotification[] = [];
  const cutoffTime = Date.now() - hoursAfter * 60 * 60 * 1000;
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // Only remind about interviews in last 7 days

  // Get applications that transitioned to interview recently
  const applications = await db.job_history
    .where("status")
    .equals("interview")
    .filter((event) => {
      const interviewAt = event.milestones?.interviewAt || event.statusChangedAt;
      // Interview happened between hoursAfter ago and 7 days ago
      return interviewAt < cutoffTime && interviewAt > recentCutoff;
    })
    .toArray();

  // Limit to 3 most recent
  const recentApps = applications
    .sort((a, b) => {
      const aTime = a.milestones?.interviewAt || a.statusChangedAt;
      const bTime = b.milestones?.interviewAt || b.statusChangedAt;
      return bTime - aTime;
    })
    .slice(0, 3);

  for (const app of recentApps) {
    const interviewTime = app.milestones?.interviewAt || app.statusChangedAt;
    const hoursAgo = Math.floor((Date.now() - interviewTime) / (60 * 60 * 1000));

    const profileName = await getProfileName(app.profileId);
    const profileSuffix = profileName ? ` (${profileName})` : "";

    notifications.push({
      id: `thank-you-${app.id}`,
      title: "Send Thank You Note",
      message: `${hoursAgo}h since interview with ${app.company || app.title || "this company"}${profileSuffix}. Send a thank-you email?`,
      type: "thank-you",
      data: { eventId: app.id, hoursAgo, profileName },
    });
  }

  return notifications;
}

/**
 * Show a notification to the user
 */
export async function showNotification(notif: ReminderNotification): Promise<void> {
  try {
    const notificationId = await chrome.notifications.create(notif.id, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("128.png"),
      title: notif.title,
      message: notif.message,
      priority: 1,
      requireInteraction: false,
    });
    console.log(`JobSnap: Created notification ${notificationId}:`, notif.title);
  } catch (error) {
    console.error(`JobSnap: Failed to create notification:`, error);
    throw error;
  }
}

/**
 * Check alerts and show notifications
 * Returns the number of notifications shown
 */
export async function checkAndNotify(): Promise<number> {
  const notifications = await checkAlerts();

  console.log(`JobSnap: Checked alerts, found ${notifications.length} notifications`);

  if (notifications.length > 0) {
    console.log('JobSnap: Notifications to show:', notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type
    })));
  }

  // Show each notification
  for (const notif of notifications) {
    try {
      await showNotification(notif);
    } catch (error) {
      console.error(`JobSnap: Failed to show notification ${notif.id}:`, error);
    }
  }

  return notifications.length;
}
