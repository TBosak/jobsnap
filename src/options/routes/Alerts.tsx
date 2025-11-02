import { useEffect, useState } from "react";
import { Bell, Clock, Target, ThumbsUp, Save, AlertCircle, Zap } from "lucide-react";
import { sendMessage } from "../../ui-shared/runtime";
import type { AlertSettings } from "../../ui-shared/schema";
import { DEFAULT_ALERT_SETTINGS } from "../../ui-shared/schema";

export function Alerts() {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await sendMessage<AlertSettings>({ type: "ALERT_GET_SETTINGS" });
      if (data) {
        setSettings(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      await sendMessage({ type: "ALERT_UPDATE_SETTINGS", settings });
      setSuccessMessage("Alert settings saved successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function updateSetting<K extends keyof AlertSettings>(
    key: K,
    value: Partial<AlertSettings[K]>
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...value },
    }));
  }

  async function testNow() {
    try {
      setTesting(true);
      setTestMessage(null);
      const result = await sendMessage<{ checked: boolean; notificationCount: number }>({
        type: "ALERT_CHECK_NOW"
      });

      if (result?.notificationCount > 0) {
        setTestMessage(`✓ Triggered ${result.notificationCount} notification${result.notificationCount > 1 ? 's' : ''}! Check your browser notifications.`);
      } else {
        setTestMessage("✓ Check complete! No reminders triggered (no applications match alert criteria).");
      }

      setTimeout(() => setTestMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading alert settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Smart Reminders</h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure intelligent notifications to stay on top of your job search
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Test Now button - uncomment for debugging */}
          {/* <button
            onClick={testNow}
            disabled={testing}
            className="
              flex items-center gap-2 rounded-full
              border-2 border-lavender
              px-5 py-2.5 text-sm font-semibold text-slate-900
              bg-white
              shadow-sm
              transition-all duration-base
              hover:bg-lavender/10 hover:scale-105
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-lavender/50 focus:ring-offset-2
            "
          >
            <Zap size={16} />
            {testing ? "Testing..." : "Test Now"}
          </button> */}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="
              flex items-center gap-2 rounded-full
              bg-gradient-to-r from-mint to-sky
              px-6 py-2.5 text-sm font-semibold text-slate-900
              shadow-md shadow-mint/30
              transition-all duration-base
              hover:shadow-lg hover:shadow-mint/40 hover:scale-105
              active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-mint/50 focus:ring-offset-2
            "
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Test Message */}
      {testMessage && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-medium text-blue-800">{testMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Alert Cards */}
      <div className="space-y-4">
        {/* No Response Reminder */}
        <AlertCard
          icon={Clock}
          title="No Response Reminder"
          description="Get notified when applications haven't received a response after a certain number of days"
          enabled={settings.noResponseReminder.enabled}
          onToggle={(enabled) =>
            updateSetting("noResponseReminder", { enabled })
          }
        >
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              Days after application:
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.noResponseReminder.daysThreshold}
              onChange={(e) =>
                updateSetting("noResponseReminder", {
                  daysThreshold: parseInt(e.target.value, 10),
                })
              }
              disabled={!settings.noResponseReminder.enabled}
              className="
                w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm
                focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                disabled:bg-slate-100 disabled:text-slate-400
              "
            />
            <span className="text-sm text-slate-600">days</span>
          </div>
        </AlertCard>

        {/* Ghosting Detection */}
        <AlertCard
          icon={AlertCircle}
          title="Ghosting Detection"
          description="Alert you when applications have been in 'Interviewing' or 'Awaiting Response' status for too long"
          enabled={settings.ghostingDetection.enabled}
          onToggle={(enabled) => updateSetting("ghostingDetection", { enabled })}
        >
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              Days without update:
            </label>
            <input
              type="number"
              min="7"
              max="180"
              value={settings.ghostingDetection.daysThreshold}
              onChange={(e) =>
                updateSetting("ghostingDetection", {
                  daysThreshold: parseInt(e.target.value, 10),
                })
              }
              disabled={!settings.ghostingDetection.enabled}
              className="
                w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm
                focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                disabled:bg-slate-100 disabled:text-slate-400
              "
            />
            <span className="text-sm text-slate-600">days</span>
          </div>
        </AlertCard>

        {/* Daily Application Goal */}
        <AlertCard
          icon={Target}
          title="Daily Application Goal"
          description="Remind you to apply to jobs if you haven't met your daily or weekly goals"
          enabled={settings.dailyApplicationGoal.enabled}
          onToggle={(enabled) =>
            updateSetting("dailyApplicationGoal", { enabled })
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 min-w-[100px]">
                Daily goal:
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={settings.dailyApplicationGoal.dailyGoal}
                onChange={(e) =>
                  updateSetting("dailyApplicationGoal", {
                    dailyGoal: parseInt(e.target.value, 10),
                  })
                }
                disabled={!settings.dailyApplicationGoal.enabled}
                className="
                  w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm
                  focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                  disabled:bg-slate-100 disabled:text-slate-400
                "
              />
              <span className="text-sm text-slate-600">applications/day</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 min-w-[100px]">
                Weekly goal:
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.dailyApplicationGoal.weeklyGoal}
                onChange={(e) =>
                  updateSetting("dailyApplicationGoal", {
                    weeklyGoal: parseInt(e.target.value, 10),
                  })
                }
                disabled={!settings.dailyApplicationGoal.enabled}
                className="
                  w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm
                  focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                  disabled:bg-slate-100 disabled:text-slate-400
                "
              />
              <span className="text-sm text-slate-600">applications/week</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 min-w-[100px]">
                Reminder time:
              </label>
              <input
                type="time"
                value={settings.dailyApplicationGoal.reminderTime}
                onChange={(e) =>
                  updateSetting("dailyApplicationGoal", {
                    reminderTime: e.target.value,
                  })
                }
                disabled={!settings.dailyApplicationGoal.enabled}
                className="
                  rounded-lg border border-slate-300 px-3 py-2 text-sm
                  focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                  disabled:bg-slate-100 disabled:text-slate-400
                "
              />
            </div>
          </div>
        </AlertCard>

        {/* Thank You Note Reminder */}
        <AlertCard
          icon={ThumbsUp}
          title="Thank You Note Reminder"
          description="Remind you to send thank-you emails after interviews"
          enabled={settings.thankYouNoteReminder.enabled}
          onToggle={(enabled) =>
            updateSetting("thankYouNoteReminder", { enabled })
          }
        >
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              Remind after:
            </label>
            <input
              type="number"
              min="1"
              max="72"
              value={settings.thankYouNoteReminder.hoursAfter}
              onChange={(e) =>
                updateSetting("thankYouNoteReminder", {
                  hoursAfter: parseInt(e.target.value, 10),
                })
              }
              disabled={!settings.thankYouNoteReminder.enabled}
              className="
                w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm
                focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20
                disabled:bg-slate-100 disabled:text-slate-400
              "
            />
            <span className="text-sm text-slate-600">hours after interview</span>
          </div>
        </AlertCard>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-sky/10 border border-sky/30 p-4 flex items-start gap-3">
        <Bell className="text-sky flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-medium text-slate-900 mb-1">
            How Smart Reminders Work
          </p>
          <p className="text-sm text-slate-600">
            JobSnap analyzes your application history and saved jobs to send timely,
            personalized reminders via browser notifications. Reminders are checked
            periodically in the background while your browser is open.
          </p>
        </div>
      </div>
    </div>
  );
}

interface AlertCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

function AlertCard({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  children,
}: AlertCardProps) {
  return (
    <div
      className={`
        rounded-xl border-2 p-5
        transition-all duration-base
        ${
          enabled
            ? "border-mint/50 bg-gradient-to-br from-mint/5 to-sky/5 shadow-md"
            : "border-slate-200 bg-white"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div
            className={`
              flex items-center justify-center w-10 h-10 rounded-full
              transition-colors duration-base
              ${
                enabled
                  ? "bg-gradient-to-r from-mint to-sky text-white"
                  : "bg-slate-100 text-slate-400"
              }
            `}
          >
            <Icon size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`
            relative inline-flex h-7 w-12 items-center rounded-full
            transition-colors duration-base
            focus:outline-none focus:ring-2 focus:ring-mint/50 focus:ring-offset-2
            ${enabled ? "bg-gradient-to-r from-mint to-sky" : "bg-slate-300"}
          `}
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white shadow-md
              transition-transform duration-base
              ${enabled ? "translate-x-6" : "translate-x-1"}
            `}
          />
        </button>
      </div>

      {/* Configuration Options */}
      {enabled && (
        <div className="ml-13 pl-3 border-l-2 border-mint/30">{children}</div>
      )}
    </div>
  );
}
