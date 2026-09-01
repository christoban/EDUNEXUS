import type { AssessmentSessionStatus } from '@domain/types/enums';

export interface HarmonizedAssessmentSessionProps {
  id: string;
  schoolId: string;
  assessmentScopeId: string;
  subjectId: string;
  classId: string;
  academicSequenceId?: string | null;
  scheduledDate: Date;
  durationMinutes?: number | null;
  status: AssessmentSessionStatus;
  createdAt: Date;
}

export class HarmonizedAssessmentSession {
  private constructor(private readonly props: HarmonizedAssessmentSessionProps) {}

  static create(props: Omit<HarmonizedAssessmentSessionProps, 'id' | 'createdAt'>): HarmonizedAssessmentSession {
    return new HarmonizedAssessmentSession({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    });
  }

  static reconstituer(props: HarmonizedAssessmentSessionProps): HarmonizedAssessmentSession {
    return new HarmonizedAssessmentSession(props);
  }

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get assessmentScopeId(): string { return this.props.assessmentScopeId; }
  get subjectId(): string { return this.props.subjectId; }
  get classId(): string { return this.props.classId; }
  get academicSequenceId(): string | null | undefined { return this.props.academicSequenceId; }
  get scheduledDate(): Date { return this.props.scheduledDate; }
  get durationMinutes(): number | null | undefined { return this.props.durationMinutes; }
  get status(): AssessmentSessionStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }

  toObject(): HarmonizedAssessmentSessionProps {
    return { ...this.props };
  }
}