import type { AlertSettings } from "../ui-shared/schema";
import { DEFAULT_ALERT_SETTINGS } from "../ui-shared/schema";

const ALERT_SETTINGS_KEY = "jobsnap.alertSettings";

/**
 * Read alert settings from Chrome storage
 */
export async function readAlertSettings(): Promise<AlertSettings> {
  const result = await chrome.storage.sync.get(ALERT_SETTINGS_KEY);
  const stored = result[ALERT_SETTINGS_KEY] as AlertSettings | undefined;

  // Merge with defaults to ensure all fields exist
  if (!stored) {
    return DEFAULT_ALERT_SETTINGS;
  }

  return {
    noResponseReminder: {
      ...DEFAULT_ALERT_SETTINGS.noResponseReminder,
      ...stored.noResponseReminder,
    },
    ghostingDetection: {
      ...DEFAULT_ALERT_SETTINGS.ghostingDetection,
      ...stored.ghostingDetection,
    },
    dailyApplicationGoal: {
      ...DEFAULT_ALERT_SETTINGS.dailyApplicationGoal,
      ...stored.dailyApplicationGoal,
    },
    thankYouNoteReminder: {
      ...DEFAULT_ALERT_SETTINGS.thankYouNoteReminder,
      ...stored.thankYouNoteReminder,
    },
  };
}

/**
 * Write alert settings to Chrome storage
 */
export async function writeAlertSettings(settings: AlertSettings): Promise<void> {
  await chrome.storage.sync.set({ [ALERT_SETTINGS_KEY]: settings });
}

/**
 * Update specific alert setting
 */
export async function updateAlertSetting<K extends keyof AlertSettings>(
  key: K,
  value: Partial<AlertSettings[K]>
): Promise<void> {
  const current = await readAlertSettings();
  current[key] = { ...current[key], ...value };
  await writeAlertSettings(current);
}
