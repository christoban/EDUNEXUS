import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { PrismaFinanceJobsRepository } from "../../persistence/prisma/PrismaFinanceJobsRepository";
import { EnvoyerRappelsPaiementUseCase } from "@application/finance/EnvoyerRappelsPaiementUseCase";
import { VerifierSeuilAbsencesUseCase } from "@application/finance/VerifierSeuilAbsencesUseCase";
import { MarquerRetardsPretUseCase } from "@application/finance/MarquerRetardsPretUseCase";

const financeJobsRepository = new PrismaFinanceJobsRepository(prisma);

export const sendPaymentReminders = inngest.createFunction(
  { id: "send-payment-reminders", name: "Relances paiement automatiques", triggers: [{ cron: "0 8 * * *" }] },
  async ({ step }) => {
    return await step.run("find-and-remind", async () => {
      const useCase = new EnvoyerRappelsPaiementUseCase(financeJobsRepository);
      return useCase.execute();
    });
  }
);

export const checkAbsenceThreshold = inngest.createFunction(
  { id: "check-absence-threshold", name: "Vérification seuil d'absences", triggers: [{ cron: "0 7 * * *" }] },
  async ({ step }) => {
    return await step.run("check-thresholds", async () => {
      const useCase = new VerifierSeuilAbsencesUseCase(financeJobsRepository);
      return useCase.execute();
    });
  }
);

export const markOverdueLoans = inngest.createFunction(
  { id: "mark-overdue-loans", name: "Marquer emprunts en retard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    const useCase = new MarquerRetardsPretUseCase(financeJobsRepository);
    const toMark = (await step.run("find-overdue-loans", async () => {
      return useCase.findOverdue();
    })) as unknown as Awaited<ReturnType<typeof useCase.findOverdue>>;

    if (toMark.length === 0) return { updated: 0 };

    await step.run("update-overdue-loans", async () => {
      await useCase.markOverdue(toMark.map((l) => (l as any).id));
    });

    await step.run("notify-overdue-loans", async () => {
      await useCase.notifyOverdue(toMark as any);
    });

    return { updated: toMark.length };
  }
);
