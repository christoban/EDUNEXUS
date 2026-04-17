import type { GradingScale } from "../models/subSystem.ts";

type GradeComputationInput = {
  rawScore: number;
  maxScore: number;
};

type AggregateInput = {
  scoreOn20: number;
  percentage: number;
  coefficient?: number;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const normalizeScoreOn20 = ({ rawScore, maxScore }: GradeComputationInput) => {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 0;
  const score = (Number(rawScore) / Number(maxScore)) * 20;
  return Number(clamp(score, 0, 20).toFixed(2));
};

export const scoreOn20ToPercentage = (scoreOn20: number) =>
  Number(clamp(Number(scoreOn20) * 5, 0, 100).toFixed(2));

export const normalizePassThresholdOn20 = (
  passThreshold: number,
  gradingScale: GradingScale
) => {
  const numeric = Number(passThreshold);
  if (!Number.isFinite(numeric)) return 10;

  if (gradingScale === "OVER_20" || gradingScale === "COMPETENCY_ANA") {
    return Number(clamp(numeric, 0, 20).toFixed(2));
  }

  const scoreOn20 = numeric > 20 ? numeric / 5 : numeric;
  return Number(clamp(scoreOn20, 0, 20).toFixed(2));
};

const scoreToGradeAE = (scoreOn20: number) => {
  if (scoreOn20 >= 16) return "A";
  if (scoreOn20 >= 13) return "B";
  if (scoreOn20 >= 10) return "C";
  if (scoreOn20 >= 8) return "D";
  return "E";
};

const scoreToCompetency = (scoreOn20: number) => {
  if (scoreOn20 >= 12) return "A";
  if (scoreOn20 >= 8) return "ECA";
  return "NA";
};

export const formatGradeLabel = (scoreOn20: number, gradingScale: GradingScale) => {
  if (gradingScale === "OVER_20") {
    return `${Number(scoreOn20.toFixed(2))}/20`;
  }

  if (gradingScale === "PERCENT") {
    return `${scoreOn20ToPercentage(scoreOn20)}%`;
  }

  if (gradingScale === "GRADES_AE") {
    return scoreToGradeAE(scoreOn20);
  }

  return scoreToCompetency(scoreOn20);
};

export const calculateAverageScoreOn20 = (
  grades: AggregateInput[],
  hasCoefficientBySubject: boolean
) => {
  if (!grades.length) return 0;

  if (!hasCoefficientBySubject) {
    const simpleAverage = grades.reduce((sum, grade) => sum + Number(grade.scoreOn20 || 0), 0) / grades.length;
    return Number(clamp(simpleAverage, 0, 20).toFixed(2));
  }

  const weightedTotal = grades.reduce(
    (sum, grade) => sum + Number(grade.scoreOn20 || 0) * Number(grade.coefficient || 1),
    0
  );
  const coefficientTotal = grades.reduce((sum, grade) => sum + Number(grade.coefficient || 1), 0) || 1;
  return Number(clamp(weightedTotal / coefficientTotal, 0, 20).toFixed(2));
};
