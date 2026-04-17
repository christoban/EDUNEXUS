import { describe, expect, test } from "bun:test";
import {
  calculateAverageScoreOn20,
  formatGradeLabel,
  normalizePassThresholdOn20,
  normalizeScoreOn20,
  scoreOn20ToPercentage,
} from "../utils/gradingEngine.ts";

describe("gradingEngine", () => {
  test("normalizeScoreOn20 converts and clamps correctly", () => {
    expect(normalizeScoreOn20({ rawScore: 15, maxScore: 20 })).toBe(15);
    expect(normalizeScoreOn20({ rawScore: 120, maxScore: 20 })).toBe(20);
    expect(normalizeScoreOn20({ rawScore: 5, maxScore: 0 })).toBe(0);
  });

  test("scoreOn20ToPercentage converts and clamps correctly", () => {
    expect(scoreOn20ToPercentage(10)).toBe(50);
    expect(scoreOn20ToPercentage(25)).toBe(100);
  });

  test("normalizePassThresholdOn20 handles OVER_20 and PERCENT modes", () => {
    expect(normalizePassThresholdOn20(10, "OVER_20")).toBe(10);
    expect(normalizePassThresholdOn20(40, "PERCENT")).toBe(8);
    expect(normalizePassThresholdOn20(200, "PERCENT")).toBe(20);
  });

  test("formatGradeLabel returns labels by grading scale", () => {
    expect(formatGradeLabel(13.5, "OVER_20")).toBe("13.5/20");
    expect(formatGradeLabel(12, "PERCENT")).toBe("60%");
    expect(formatGradeLabel(17, "GRADES_AE")).toBe("A");
    expect(formatGradeLabel(9, "COMPETENCY_ANA")).toBe("ECA");
  });

  test("calculateAverageScoreOn20 supports simple and weighted averages", () => {
    const grades = [
      { scoreOn20: 10, percentage: 50, coefficient: 2 },
      { scoreOn20: 14, percentage: 70, coefficient: 1 },
    ];

    expect(calculateAverageScoreOn20(grades, false)).toBe(12);
    expect(calculateAverageScoreOn20(grades, true)).toBe(11.33);
  });
});
