import { describe, expect, test } from "bun:test";
import bcrypt from "bcryptjs";
import {
  normalizeRecoveryCode,
  verifyAndConsumeRecoveryCode,
  verifyMfaOrRecoveryCode,
} from "../controllers/masterAdmin.ts";

describe("master MFA helpers", () => {
  test("normalizeRecoveryCode strips punctuation and uppercases values", () => {
    expect(normalizeRecoveryCode(" ab-cd 12-34 ")).toBe("ABCD1234");
  });

  test("verifyAndConsumeRecoveryCode removes the matched hash", async () => {
    const hashes = [
      await bcrypt.hash(normalizeRecoveryCode("AAAA-BBBB"), 4),
      await bcrypt.hash(normalizeRecoveryCode("CCCC-DDDD"), 4),
    ];

    const result = await verifyAndConsumeRecoveryCode("aaaa-bbbb", hashes);

    expect(result.matched).toBe(true);
    expect(result.updatedHashes).toHaveLength(1);
  });

  test("verifyMfaOrRecoveryCode accepts recovery codes when TOTP fails", async () => {
    const recoveryHashes = [await bcrypt.hash(normalizeRecoveryCode("123456"), 4)];

    const result = await verifyMfaOrRecoveryCode(
      "123456",
      "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      recoveryHashes,
      true
    );

    expect(result.valid).toBe(true);
    expect(result.usedRecoveryCode).toBe(true);
    expect(result.updatedRecoveryCodeHashes).toHaveLength(0);
  });
});
