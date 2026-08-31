/**
 * @file notifications.js
 * @description High-reliability Local Notification & Daily Habit-Protection Engine for Utkio.
 * Manages Commit Mode 4-tier daily accountability reminders, 11:00 PM sticky countdown chronometer,
 * normal user daily practice nudges, streak savers, and smart early-completion auto-suppression.
 * 
 * 100% Offline-capable, zero server cost, strict IST timezone synchronization.
 */

// ═══════════════════════════════════════════════════════════════
// 1. CONSTANTS & IDENTIFIERS
// ═══════════════════════════════════════════════════════════════

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30 in ms (19,800,000 ms)

export const NOTIF_ID_COMMIT_LUNCH = 1001;            // 02:00 PM IST
export const NOTIF_ID_COMMIT_EVENING = 1002;          // 06:30 PM IST
export const NOTIF_ID_COMMIT_NIGHT = 1003;            // 09:30 PM IST
export const NOTIF_ID_COMMIT_STICKY_COUNTDOWN = 1004; // 11:00 PM IST (Sticky Live Chronometer)

export const NOTIF_ID_NORMAL_DAILY = 2001;            // Configurable (default 07:30 PM IST)
export const NOTIF_ID_NORMAL_STREAK = 2002;           // 09:45 PM IST

export const NOTIF_ID_REPORT_READY = 3001;            // 30s post-session

export const CHANNEL_COMMIT_MODE = 'commit_mode_channel';
export const CHANNEL_PRACTICE_HABIT = 'practice_habit_channel';
export const CHANNEL_SESSION_REPORTS = 'session_reports_channel';

const PREFS_STORAGE_KEY = 'utkio_notification_preferences_v1';

// Default user preferences
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  dailyEnabled: true,
  preferredHour: 19, // 7 PM
  preferredMinute: 30, // :30 PM (07:30 PM IST)
  commitRemindersEnabled: true,
  streakSaverEnabled: true,
  reportsEnabled: true
};

// ═══════════════════════════════════════════════════════════════
// 2. PURE IST TIME CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculates the exact UTC Date for a given IST hour:minute on today's IST date.
 * If that time has already passed today in IST, returns null.
 * 
 * @param {number} hour - 0 to 23 (IST)
 * @param {number} minute - 0 to 59 (IST)
 * @param {Date} [referenceDate=new Date()] - Reference instant
 * @returns {Date|null} - UTC Date for the slot, or null if passed today
 */
export function getIstTargetDate(hour, minute, referenceDate = new Date()) {
  const refTime = referenceDate.getTime();
  const istNow = new Date(refTime + IST_OFFSET_MS);

  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const date = istNow.getUTCDate();

  // Construct target timestamp as if UTC, then subtract IST offset to get real UTC epoch
  const targetEpoch = Date.UTC(year, month, date, hour, minute, 0, 0) - IST_OFFSET_MS;

  if (targetEpoch <= refTime) {
    return null; // Slot already elapsed today
  }

  return new Date(targetEpoch);
}

/**
 * Returns the exact UTC Date of the next upcoming 00:00:00 IST Midnight boundary.
 * 
 * @param {Date} [referenceDate=new Date()]
 * @returns {Date}
 */
export function getNextIstMidnightDate(referenceDate = new Date()) {
  const refTime = referenceDate.getTime();
  const istNow = new Date(refTime + IST_OFFSET_MS);

  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const date = istNow.getUTCDate();

  // Tomorrow 00:00:00 IST
  const nextMidnightEpoch = Date.UTC(year, month, date + 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(nextMidnightEpoch);
}

// ═══════════════════════════════════════════════════════════════
// 3. ADAPTIVE NOTIFICATION MICRO-COPY GENERATORS
// ═══════════════════════════════════════════════════════════════

/**
 * Generates progress-adaptive copy for Commit Mode users based on remaining requirements.
 * Returns null if BOTH requirements are already met (suppression signal).
 */
export function getCommitModeNotificationCopy({
  chatSecondsDone = 0,
  chatTargetSeconds = 300,
  scenarioDone = false,
  slotName = 'evening'
}) {
  const chatMet = chatSecondsDone >= chatTargetSeconds;
  const scenarioMet = Boolean(scenarioDone);

  if (chatMet && scenarioMet) {
    return null; // Both done -> Suppress / No notification needed
  }

  const secondsLeft = Math.max(0, chatTargetSeconds - chatSecondsDone);
  const minutesLeft = Math.ceil(secondsLeft / 60);

  // Case A: Chat is DONE, Scenario is PENDING
  if (chatMet && !scenarioMet) {
    if (slotName === 'sticky_countdown') {
      return {
        title: '🚨 Utkio • Commit Mode: 1 Hour Left',
        body: 'Great chat! Bas 1 scenario baaki hai (takes 3 mins). Finish before midnight reset!',
        actionText: 'Start Scenario'
      };
    }
    return {
      title: '🎯 Utkio Commit Mode: Scenario Pending',
      body: 'Great chat! Bas aaj ka 1 Scenario baaki hai (takes 3 mins). Din khatam hone se pehle finish karein!'
    };
  }

  // Case B: Scenario is DONE, Chat is PENDING
  if (!chatMet && scenarioMet) {
    if (slotName === 'sticky_countdown') {
      return {
        title: '🚨 Utkio • Commit Mode: 1 Hour Left',
        body: `Scenario done! Bas ${minutesLeft} min conversation baaki hai before midnight reset!`,
        actionText: 'Start 5-Min Chat'
      };
    }
    return {
      title: `⏳ Utkio Commit Mode: ${minutesLeft} Min Chat Left`,
      body: `Scenario done! Bas ${minutesLeft} min ki conversation baaki hai. Keep your commitment safe!`
    };
  }

  // Case C: BOTH are PENDING
  switch (slotName) {
    case 'lunch':
      return {
        title: '🍱 Lunch Break Practice • Utkio Commit Mode',
        body: 'Free during lunch? 5 min Bolo ke sath English bol lo — aaj ka commitment abhi finish ho jayega!'
      };
    case 'evening':
      return {
        title: '☕ Evening Check-in • Utkio Commit Mode',
        body: 'Evening check-in: Sirf 5 min chat + 1 scenario baki hai. Din khatam hone se pehle finish karein!'
      };
    case 'night':
      return {
        title: '🌙 2.5 Hours Left • Utkio Commit Mode',
        body: '2.5 hours to midnight: Apni streak aur commitment maintain rakhne ke liye abhi 5 min practice karein.'
      };
    case 'sticky_countdown':
    default:
      return {
        title: '🚨 Utkio • Commit Mode: 1 Hour Left',
        body: 'Complete your 5-min talk & scenario before 12:00 AM midnight to protect your commitment!',
        actionText: 'Start Practice'
      };
  }
}

/**
 * Generates copy for Normal Users (Free Trial / Starter / Unlimited).
 */
export function getNormalUserNotificationCopy({
  name = 'there',
  streak = 0,
  type = 'daily'
}) {
  const safeName = name && name !== 'there' ? name : 'there';

  if (type === 'streak' && streak >= 2) {
    return {
      title: `🔥 Don't lose your ${streak}-day streak!`,
      body: `Hey ${safeName}! Protect your ${streak}-day streak — speak with Bolo for just 2 mins to keep the flame alive tonight.`
    };
  }

  return {
    title: `✨ Time for your 5-min English boost`,
    body: `Hey ${safeName}! Time for your 5-min English boost. Aaj ek interesting topic pe baat karein?`
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. PURE SLOT COMPUTERS
// ═══════════════════════════════════════════════════════════════

/**
 * Computes all future notification slots for Commit Mode today.
 */
export function computePendingCommitModeSlots({
  chatSecondsDone = 0,
  chatTargetSeconds = 300,
  scenarioDone = false,
  referenceDate = new Date()
}) {
  const isComplete = (chatSecondsDone >= chatTargetSeconds) && Boolean(scenarioDone);
  if (isComplete) return [];

  const slots = [];

  // Slot 1: 02:00 PM IST (14:00)
  const lunchTime = getIstTargetDate(14, 0, referenceDate);
  if (lunchTime) {
    const copy = getCommitModeNotificationCopy({ chatSecondsDone, chatTargetSeconds, scenarioDone, slotName: 'lunch' });
    if (copy) {
      slots.push({
        id: NOTIF_ID_COMMIT_LUNCH,
        title: copy.title,
        body: copy.body,
        scheduleAt: lunchTime,
        channelId: CHANNEL_COMMIT_MODE,
        extra: { slot: 'lunch' }
      });
    }
  }

  // Slot 2: 06:30 PM IST (18:30)
  const eveningTime = getIstTargetDate(18, 30, referenceDate);
  if (eveningTime) {
    const copy = getCommitModeNotificationCopy({ chatSecondsDone, chatTargetSeconds, scenarioDone, slotName: 'evening' });
    if (copy) {
      slots.push({
        id: NOTIF_ID_COMMIT_EVENING,
        title: copy.title,
        body: copy.body,
        scheduleAt: eveningTime,
        channelId: CHANNEL_COMMIT_MODE,
        extra: { slot: 'evening' }
      });
    }
  }

  // Slot 3: 09:30 PM IST (21:30)
  const nightTime = getIstTargetDate(21, 30, referenceDate);
  if (nightTime) {
    const copy = getCommitModeNotificationCopy({ chatSecondsDone, chatTargetSeconds, scenarioDone, slotName: 'night' });
    if (copy) {
      slots.push({
        id: NOTIF_ID_COMMIT_NIGHT,
        title: copy.title,
        body: copy.body,
        scheduleAt: nightTime,
        channelId: CHANNEL_COMMIT_MODE,
        extra: { slot: 'night', priority: 'high' }
      });
    }
  }

  // Slot 4: 11:00 PM IST (23:00) — STICKY ONGOING CHRONOMETER
  const stickyTime = getIstTargetDate(23, 0, referenceDate);
  if (stickyTime) {
    const copy = getCommitModeNotificationCopy({ chatSecondsDone, chatTargetSeconds, scenarioDone, slotName: 'sticky_countdown' });
    if (copy) {
      const midnightTime = getNextIstMidnightDate(referenceDate);
      const targetEpoch = midnightTime ? midnightTime.getTime() : 0;
      const minValidEpoch = Math.max(referenceDate.getTime(), stickyTime.getTime());
      if (targetEpoch > minValidEpoch) {
        slots.push({
          id: NOTIF_ID_COMMIT_STICKY_COUNTDOWN,
          title: copy.title,
          body: copy.body,
          scheduleAt: stickyTime,
          channelId: CHANNEL_COMMIT_MODE,
          extra: {
            slot: 'sticky_countdown',
            isSticky: true,
            usesChronometer: true,
            chronometerTargetEpoch: targetEpoch,
            actionText: copy.actionText || 'Start Practice'
          }
        });
      }
    }
  }

  return slots;
}

/**
 * Computes all future notification slots for Normal Users today.
 */
export function computePendingNormalUserSlots({
  practiceDoneToday = false,
  streak = 0,
  name = 'there',
  preferredHour = 19,
  preferredMinute = 30,
  referenceDate = new Date()
}) {
  if (practiceDoneToday) return [];

  const slots = [];

  // Slot A: Daily practice reminder (e.g. 07:30 PM IST)
  const dailyTime = getIstTargetDate(preferredHour, preferredMinute, referenceDate);
  if (dailyTime) {
    const copy = getNormalUserNotificationCopy({ name, streak, type: 'daily' });
    slots.push({
      id: NOTIF_ID_NORMAL_DAILY,
      title: copy.title,
      body: copy.body,
      scheduleAt: dailyTime,
      channelId: CHANNEL_PRACTICE_HABIT,
      extra: { slot: 'normal_daily' }
    });
  }

  // Slot B: Streak saver alert (09:45 PM IST) if streak >= 2
  if (streak >= 2) {
    const streakTime = getIstTargetDate(21, 45, referenceDate);
    if (streakTime) {
      const copy = getNormalUserNotificationCopy({ name, streak, type: 'streak' });
      slots.push({
        id: NOTIF_ID_NORMAL_STREAK,
        title: copy.title,
        body: copy.body,
        scheduleAt: streakTime,
        channelId: CHANNEL_PRACTICE_HABIT,
        extra: { slot: 'normal_streak' }
      });
    }
  }

  return slots;
}

// ═══════════════════════════════════════════════════════════════
// 5. CAPACITOR LOCAL NOTIFICATIONS BRIDGE & STATE
// ═══════════════════════════════════════════════════════════════

let localNotificationsPlugin = null;

async function getLocalNotificationsPlugin() {
  if (localNotificationsPlugin) return localNotificationsPlugin;
  try {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('LocalNotifications')) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      localNotificationsPlugin = LocalNotifications;
      return localNotificationsPlugin;
    }
  } catch (err) {
    console.warn('[notifications] LocalNotifications plugin unavailable in this environment:', err);
  }
  return null;
}

/**
 * Reads notification preferences from localStorage.
 */
export function getNotificationPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Saves notification preferences to localStorage.
 */
export function saveNotificationPreferences(prefs) {
  try {
    const updated = { ...getNotificationPreferences(), ...prefs };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/**
 * Requests native notification permissions gracefully.
 */
export async function requestNotificationPermissions() {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin) return { granted: true, mocked: true };

  try {
    const check = await plugin.checkPermissions();
    if (check.display === 'granted') return { granted: true };

    const req = await plugin.requestPermissions();
    return { granted: req.display === 'granted' };
  } catch (err) {
    console.warn('[notifications] Failed to request permissions:', err);
    return { granted: false, error: err };
  }
}

/**
 * Registers Android Notification Channels with appropriate importance and sound.
 */
export async function createNotificationChannels() {
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin || !plugin.createChannel) return;

  try {
    await plugin.createChannel({
      id: CHANNEL_COMMIT_MODE,
      name: 'Commit Mode Reminders',
      description: 'Critical reminders and countdowns to protect your Commit Mode daily streak',
      importance: 5, // High priority / Heads-up notification
      visibility: 1,
      vibration: true
    });

    await plugin.createChannel({
      id: CHANNEL_PRACTICE_HABIT,
      name: 'Daily Practice Habit',
      description: 'Daily gentle reminders to maintain your English speaking practice',
      importance: 3, // Default priority
      visibility: 1,
      vibration: true
    });

    await plugin.createChannel({
      id: CHANNEL_SESSION_REPORTS,
      name: 'Practice Reports',
      description: 'Alerts when your AI conversation feedback report is ready',
      importance: 3,
      visibility: 1,
      vibration: false
    });
  } catch (err) {
    console.warn('[notifications] Failed to create notification channels:', err);
  }
}

/**
 * Cancels a list of notification IDs.
 */
export async function cancelNotificationsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const plugin = await getLocalNotificationsPlugin();
  if (!plugin) return;

  try {
    const notifs = ids.map(id => ({ id }));
    await plugin.cancel({ notifications: notifs });
  } catch (err) {
    console.warn('[notifications] Failed to cancel notifications:', err);
  }
}

/**
 * Dismisses the persistent 11:00 PM sticky countdown notification immediately.
 */
export async function dismissStickyCountdown() {
  await cancelNotificationsByIds([NOTIF_ID_COMMIT_STICKY_COUNTDOWN]);
}

/**
 * Dismisses any scheduled report-ready reminder notification (e.g. when report is opened).
 */
export async function dismissReportReadyNotification() {
  await cancelNotificationsByIds([NOTIF_ID_REPORT_READY]);
}

/**
 * Synchronizes the daily notification schedule for the current user.
 * Called on Home screen mount, app resume, and plan changes.
 */
export async function syncDailyNotificationSchedule({
  plan = 'none',
  chatSecondsDone = 0,
  scenarioDone = false,
  streak = 0,
  name = 'there'
} = {}) {
  const plugin = await getLocalNotificationsPlugin();
  const prefs = getNotificationPreferences();

  if (!prefs.dailyEnabled) {
    // If user disabled reminders in Settings, wipe all scheduled alerts
    await cancelNotificationsByIds([
      NOTIF_ID_COMMIT_LUNCH,
      NOTIF_ID_COMMIT_EVENING,
      NOTIF_ID_COMMIT_NIGHT,
      NOTIF_ID_COMMIT_STICKY_COUNTDOWN,
      NOTIF_ID_NORMAL_DAILY,
      NOTIF_ID_NORMAL_STREAK
    ]);
    return { status: 'disabled' };
  }

  await createNotificationChannels();

  const isCommitMode = plan === 'commit_mode';
  const now = new Date();

  if (isCommitMode) {
    // Commit Mode Plan:
    // 1. Cancel normal habit alarms to avoid duplicate noise
    await cancelNotificationsByIds([NOTIF_ID_NORMAL_DAILY, NOTIF_ID_NORMAL_STREAK]);

    const isComplete = (chatSecondsDone >= 300) && Boolean(scenarioDone);
    if (isComplete) {
      // Both goals met! Cancel all remaining night alerts and dismiss sticky
      await cancelNotificationsByIds([
        NOTIF_ID_COMMIT_LUNCH,
        NOTIF_ID_COMMIT_EVENING,
        NOTIF_ID_COMMIT_NIGHT,
        NOTIF_ID_COMMIT_STICKY_COUNTDOWN
      ]);
      return { status: 'completed_all_cancelled' };
    }

    const pendingSlots = computePendingCommitModeSlots({
      chatSecondsDone,
      chatTargetSeconds: 300,
      scenarioDone,
      referenceDate: now
    });

    if (pendingSlots.length > 0 && plugin) {
      const notificationsToSchedule = pendingSlots.map(slot => ({
        id: slot.id,
        title: slot.title,
        body: slot.body,
        channelId: slot.channelId,
        schedule: { at: slot.scheduleAt },
        ongoing: slot.extra?.isSticky || false,
        autoCancel: !(slot.extra?.isSticky),
        extra: slot.extra
      }));

      try {
        await plugin.schedule({ notifications: notificationsToSchedule });
      } catch (scheduleErr) {
        console.warn('[notifications] Failed scheduling Commit Mode notifications:', scheduleErr);
      }
    }

    return { status: 'commit_mode_synced', scheduledCount: pendingSlots.length };
  }

  // Normal Users (Trial, Starter, Unlimited):
  // 1. Cancel Commit Mode alarms
  await cancelNotificationsByIds([
    NOTIF_ID_COMMIT_LUNCH,
    NOTIF_ID_COMMIT_EVENING,
    NOTIF_ID_COMMIT_NIGHT,
    NOTIF_ID_COMMIT_STICKY_COUNTDOWN
  ]);

  const practiceDoneToday = chatSecondsDone >= 300 || scenarioDone;
  if (practiceDoneToday) {
    await cancelNotificationsByIds([NOTIF_ID_NORMAL_DAILY, NOTIF_ID_NORMAL_STREAK]);
    return { status: 'normal_practice_done_cancelled' };
  }

  const pendingSlots = computePendingNormalUserSlots({
    practiceDoneToday,
    streak,
    name,
    preferredHour: prefs.preferredHour,
    preferredMinute: prefs.preferredMinute,
    referenceDate: now
  });

  if (pendingSlots.length > 0 && plugin) {
    const notificationsToSchedule = pendingSlots.map(slot => ({
      id: slot.id,
      title: slot.title,
      body: slot.body,
      channelId: slot.channelId,
      schedule: { at: slot.scheduleAt },
      extra: slot.extra
    }));

    try {
      await plugin.schedule({ notifications: notificationsToSchedule });
    } catch (scheduleErr) {
      console.warn('[notifications] Failed scheduling normal notifications:', scheduleErr);
    }
  }

  return { status: 'normal_synced', scheduledCount: pendingSlots.length };
}

/**
 * Schedules an alert for when a session report analysis finishes (30s delay).
 */
export async function scheduleReportReadyNotification({ delaySeconds = 30 } = {}) {
  const plugin = await getLocalNotificationsPlugin();
  const prefs = getNotificationPreferences();
  if (!plugin || !prefs.reportsEnabled) return;

  const targetDate = new Date(Date.now() + delaySeconds * 1000);

  try {
    await plugin.schedule({
      notifications: [
        {
          id: NOTIF_ID_REPORT_READY,
          title: '✨ Your practice report is ready!',
          body: 'Tap to view your personalized feedback, corrections, and vocabulary tips.',
          channelId: CHANNEL_SESSION_REPORTS,
          schedule: { at: targetDate }
        }
      ]
    });
  } catch (err) {
    console.warn('[notifications] Failed to schedule report ready notification:', err);
  }
}
