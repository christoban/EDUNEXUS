/**
 * INFRASTRUCTURE LAYER — Adapter Groq (remplace Google Gemini)
 * Implémente IAService.
 */
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import type {
  IAService,
  DonneesIndiceSante,
  ResultatIndiceSante,
} from '@domain/ports/services/IAService';
import { instructionLangue, type Language } from '../../utils/languageHelper';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY ?? '',
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';

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

async function genererAvecGroq(prompt: string, lang: Language = 'fr'): Promise<string> {
  const { text } = await generateText({
    model: groq(GROQ_MODEL),
    system: `Tu es un conseiller pédagogique camerounais. N'utilise pas de Markdown. ${instructionLangue(lang)}`,
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

    const analyse = await genererAvecGroq(prompt, donnees.langue ?? 'fr');
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
    const lang: Language = params.langue === 'EN' ? 'en' : 'fr';
    const langue = lang === 'en' ? 'English' : 'français';
    const prompt = `
Génère un commentaire de bulletin scolaire en ${langue} pour ${params.nomEleve}.
Moyenne : ${params.moyenneGenerale.toFixed(2)}/20. Tendance : ${params.evolution}.
Points forts : ${params.pointsForts.join(', ') || 'aucun identifié'}.
Points faibles : ${params.pointsFaibles.join(', ') || 'aucun identifié'}.
2-3 phrases, ton encourageant et professionnel.
    `.trim();

    return genererAvecGroq(prompt, lang);
  }

  async genererEmploiDuTemps(
    contraintes: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const prompt = `
Génère un emploi du temps scolaire respectant ces contraintes :
${JSON.stringify(contraintes, null, 2)}
Retourne un JSON structuré avec les créneaux.
    `.trim();

    const resultat = await genererAvecGroq(prompt);
    try {
      return JSON.parse(resultat) as Record<string, unknown>;
    } catch {
      return { raw: resultat };
    }
  }
}
