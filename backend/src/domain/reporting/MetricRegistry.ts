export type MetricKey = 'taux_presence' | 'moyenne_generale';

export interface MetricDimensions {
  schoolId: string;
  classId?: string;
  studentId?: string;
  teacherId?: string;
  academicPeriodId?: string;
  sequenceId?: string;
  dateRange?: { from: string; to: string };
}

export interface MetricDefinition {
  key: MetricKey;
  dimensions: (keyof MetricDimensions)[];
  defaultTtlMs: number;
  enabled: boolean;
}

export interface MetricComputeContext {
  presenceRepository: import('@domain/ports/repositories/PresenceRepository').PresenceRepository;
  noteRepository: import('@domain/ports/repositories/NoteRepository').NoteRepository;
  statisticsQueryRepository: import('@domain/ports/repositories/StatisticsQueryRepository').StatisticsQueryRepository;
  prisma: any; // hex-allow-any: contexte de calcul direct pour dateRange copilot — évite un port dédié en v1
}

export type MetricComputeFn = (
  dimensions: MetricDimensions,
  ctx: MetricComputeContext,
) => Promise<number>;

export interface MetricRegistryPort {
  getDefinition(key: MetricKey): MetricDefinition | undefined;
  getComputeFn(key: MetricKey): MetricComputeFn;
  validateDimensions(key: MetricKey, dims: MetricDimensions): void;
}