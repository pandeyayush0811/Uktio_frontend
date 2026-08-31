import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIstTargetDate,
  getCommitModeNotificationCopy,
  getNormalUserNotificationCopy,
  computePendingCommitModeSlots,
  computePendingNormalUserSlots,
  NOTIF_ID_COMMIT_LUNCH,
  NOTIF_ID_COMMIT_EVENING,
  NOTIF_ID_COMMIT_NIGHT,
  NOTIF_ID_COMMIT_STICKY_COUNTDOWN,
  NOTIF_ID_NORMAL_DAILY,
  NOTIF_ID_NORMAL_STREAK,
  NOTIF_ID_REPORT_READY
} from './notifications.js';

describe('Notifications Engine - Core Logic & IST Scheduling', () => {
  describe('getIstTargetDate', () => {
    it('correctly calculates IST slot for today when slot time is in the future', () => {
      // 10:00 AM IST on 2026-08-31 is 04:30:00 UTC
      const mockNow = new Date(Date.UTC(2026, 7, 31, 4, 30, 0)); // 10:00 AM IST
      const target2pm = getIstTargetDate(14, 0, mockNow); // 02:00 PM IST is 08:30:00 UTC

      expect(target2pm).not.toBeNull();
      expect(target2pm.getUTCFullYear()).toBe(2026);
      expect(target2pm.getUTCMonth()).toBe(7);
      expect(target2pm.getUTCDate()).toBe(31);
      expect(target2pm.getUTCHours()).toBe(8); // 14:00 IST - 5:30 = 08:30 UTC
      expect(target2pm.getUTCMinutes()).toBe(30);
    });

    it('returns null if target slot has already passed in IST today', () => {
      // 03:00 PM IST on 2026-08-31 is 09:30:00 UTC
      const mockNow = new Date(Date.UTC(2026, 7, 31, 9, 30, 0)); // 03:00 PM IST
      const target2pm = getIstTargetDate(14, 0, mockNow); // 02:00 PM IST has passed today

      expect(target2pm).toBeNull();
    });

    it('correctly calculates 11:00 PM IST and midnight boundary in UTC', () => {
      // 08:00 PM IST (14:30 UTC)
      const mockNow = new Date(Date.UTC(2026, 7, 31, 14, 30, 0));
      const target11pm = getIstTargetDate(23, 0, mockNow); // 23:00 IST is 17:30 UTC

      expect(target11pm).not.toBeNull();
      expect(target11pm.getUTCHours()).toBe(17);
      expect(target11pm.getUTCMinutes()).toBe(30);
    });
  });

  describe('getCommitModeNotificationCopy (Adaptive Micro-Copy)', () => {
    it('returns both requirements message when zero chat and zero scenario completed', () => {
      const copy = getCommitModeNotificationCopy({
        chatSecondsDone: 0,
        chatTargetSeconds: 300,
        scenarioDone: false,
        slotName: 'lunch'
      });

      expect(copy).not.toBeNull();
      expect(copy.title).toContain('Commit Mode');
      expect(copy.body).toContain('5 min Bolo');
    });

    it('adapts message to only mention pending scenario when 5m chat is already done', () => {
      const copy = getCommitModeNotificationCopy({
        chatSecondsDone: 300,
        chatTargetSeconds: 300,
        scenarioDone: false,
        slotName: 'evening'
      });

      expect(copy).not.toBeNull();
      expect(copy.body).toContain('Scenario baaki hai');
      expect(copy.body).not.toContain('5 min chat');
    });

    it('adapts message to only mention pending chat time when scenario is already done', () => {
      const copy = getCommitModeNotificationCopy({
        chatSecondsDone: 180, // 3 mins done, 2 mins left
        chatTargetSeconds: 300,
        scenarioDone: true,
        slotName: 'night'
      });

      expect(copy).not.toBeNull();
      expect(copy.body).toContain('2 min ki conversation baaki hai');
      expect(copy.body).not.toContain('Scenario baaki');
    });

    it('returns null when BOTH requirements are met (suppression)', () => {
      const copy = getCommitModeNotificationCopy({
        chatSecondsDone: 320,
        chatTargetSeconds: 300,
        scenarioDone: true,
        slotName: 'night'
      });

      expect(copy).toBeNull();
    });
  });

  describe('computePendingCommitModeSlots', () => {
    it('returns all 4 future slots when user checks in at 10:00 AM IST with zero progress', () => {
      const mockNow = new Date(Date.UTC(2026, 7, 31, 4, 30, 0)); // 10:00 AM IST
      const slots = computePendingCommitModeSlots({
        chatSecondsDone: 0,
        scenarioDone: false,
        referenceDate: mockNow
      });

      expect(slots.length).toBe(4);
      expect(slots.map(s => s.id)).toEqual([
        NOTIF_ID_COMMIT_LUNCH,
        NOTIF_ID_COMMIT_EVENING,
        NOTIF_ID_COMMIT_NIGHT,
        NOTIF_ID_COMMIT_STICKY_COUNTDOWN
      ]);
      expect(slots[3].extra.isSticky).toBe(true);
      expect(slots[3].extra.usesChronometer).toBe(true);
    });

    it('returns only 9:30 PM and 11:00 PM slots when user checks in at 07:00 PM IST', () => {
      const mockNow = new Date(Date.UTC(2026, 7, 31, 13, 30, 0)); // 07:00 PM IST (13:30 UTC)
      const slots = computePendingCommitModeSlots({
        chatSecondsDone: 100,
        scenarioDone: false,
        referenceDate: mockNow
      });

      expect(slots.length).toBe(2);
      expect(slots.map(s => s.id)).toEqual([
        NOTIF_ID_COMMIT_NIGHT,
        NOTIF_ID_COMMIT_STICKY_COUNTDOWN
      ]);
    });

    it('returns empty array when daily commitments are fully satisfied', () => {
      const mockNow = new Date(Date.UTC(2026, 7, 31, 8, 30, 0)); // 02:00 PM IST
      const slots = computePendingCommitModeSlots({
        chatSecondsDone: 300,
        scenarioDone: true,
        referenceDate: mockNow
      });

      expect(slots.length).toBe(0);
    });
  });

  describe('computePendingNormalUserSlots', () => {
    it('schedules daily practice reminder and streak alert if streak >= 2 and unpracticed', () => {
      const mockNow = new Date(Date.UTC(2026, 7, 31, 4, 30, 0)); // 10:00 AM IST
      const slots = computePendingNormalUserSlots({
        practiceDoneToday: false,
        streak: 4,
        name: 'Aman',
        preferredHour: 19,
        preferredMinute: 30,
        referenceDate: mockNow
      });

      expect(slots.length).toBe(2);
      expect(slots.map(s => s.id)).toEqual([
        NOTIF_ID_NORMAL_DAILY,
        NOTIF_ID_NORMAL_STREAK
      ]);
      expect(slots[0].body).toContain('5-min English boost');
      expect(slots[1].body).toContain('4-day streak');
    });

    it('returns empty array if user already completed practice today', () => {
      const mockNow = new Date(Date.UTC(2026, 7, 31, 4, 30, 0));
      const slots = computePendingNormalUserSlots({
        practiceDoneToday: true,
        streak: 4,
        referenceDate: mockNow
      });

      expect(slots.length).toBe(0);
    });
  });
});
