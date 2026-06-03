/**
 * INFRASTRUCTURE LAYER — Adapter Google Gemini
 * Implémente IAService. Migré depuis src/services/gemini.ts.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import type {
  IAService,
  DonneesIndiceSante,
  ResultatIndiceSante,
} from '@domain/ports/services/IAService';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY ?? '',
});

function nettoyerMarkdown(texte: string): string {
  return texte
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/^[-*+]\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function genererAvecGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const { text } = await generateText({
    model: google('gemini-flash-latest'),
    system: systemPrompt ?? 'Tu es un conseiller pédagogique camerounais. Réponds en français, sans Markdown.',
    prompt,
    maxOutputTokens: 1000,
  });
  return nettoyerMarkdown(text);
}

export class GeminiIAService implements IAService {
  async calculerIndiceSante(donnees: DonneesIndiceSante): Promise<ResultatIndiceSante> {
    const niveaux: Array<{ max: number; niveau: ResultatIndiceSante['niveau'] }> = [
      { max: 30,  niveau: 'CRITIQUE' },
      { max: 50,  niveau: 'ELEVE' },
      { max: 70,  niveau: 'MOYEN' },
      { max: 85,  niveau: 'STABLE' },
      { max: 100, niveau: 'PROGRESSION' },
    ];

    const score = Math.round(
      (donnees.moyenneGenerale / 20) * 100 * 0.35 +
      donnees.tauxPresence * 0.25 +
      50 * 0.20 +
      Math.max(0, 100 - donnees.nombreSanctions * 20) * 0.10 +
      donnees.tauxPaiement * 0.10
    );

    const niveau = niveaux.find(n => score <= n.max)?.niveau ?? 'PROGRESSION';

    const prompt = `
Élève avec : moyenne ${donnees.moyenneGenerale.toFixed(1)}/20, présence ${donnees.tauxPresence.toFixed(0)}%, ${donnees.nombreSanctions} sanction(s).
Niveau de santé scolaire : ${niveau} (score ${score}/100).
Donne 2-3 recommandations courtes et concrètes pour l'enseignant.
    `.trim();

    const analyse = await genererAvecGemini(prompt);
    const recommandations = analyse
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 3);

    return { score: Math.max(0, Math.min(100, score)), niveau, recommandations };
  }

  async genererCommentaireBulletin(params: {
    nomEleve: string;
    moyenneGenerale: number;
    evolution: 'HAUSSE' | 'BAISSE' | 'STABLE';
    pointsForts: string[];
    pointsFaibles: string[];
    langue: 'FR' | 'EN';
  }): Promise<string> {
    const langue = params.langue === 'EN' ? 'English' : 'français';
    const prompt = `
Génère un commentaire de bulletin scolaire en ${langue} pour ${params.nomEleve}.
Moyenne : ${params.moyenneGenerale.toFixed(2)}/20. Tendance : ${params.evolution}.
Points forts : ${params.pointsForts.join(', ') || 'aucun identifié'}.
Points faibles : ${params.pointsFaibles.join(', ') || 'aucun identifié'}.
2-3 phrases, ton encourageant et professionnel.
    `.trim();

    return genererAvecGemini(prompt);
  }

  async genererEmploiDuTemps(
    contraintes: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const prompt = `
Génère un emploi du temps scolaire respectant ces contraintes :
${JSON.stringify(contraintes, null, 2)}
Retourne un JSON structuré avec les créneaux.
    `.trim();

    const resultat = await genererAvecGemini(prompt);
    try {
      return JSON.parse(resultat) as Record<string, unknown>;
    } catch {
      return { raw: resultat };
    }
  }
}
