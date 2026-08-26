export interface SmsNotificationPort {
  notifyBulletinSms(opts: {
    schoolId: string;
    studentId: string;
    studentName: string;
    periodName: string;
  }): Promise<void>;

  notifyLv2WindowOpenSms(opts: {
    schoolId: string;
    studentUserId: string;
    studentName: string;
    level: string;
    closeDate: Date;
  }): Promise<void>;
}
