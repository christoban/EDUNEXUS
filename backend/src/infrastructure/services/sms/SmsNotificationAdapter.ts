import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import { notifyBulletinSms, notifyLv2WindowOpenSms } from './SmsNotificationService';

export class SmsNotificationAdapter implements SmsNotificationPort {
  async notifyBulletinSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    periodName: string;
  }): Promise<void> {
    await notifyBulletinSms(opts);
  }

  async notifyLv2WindowOpenSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    level: string;
    closeDate: Date;
  }): Promise<void> {
    await notifyLv2WindowOpenSms(opts);
  }
}
