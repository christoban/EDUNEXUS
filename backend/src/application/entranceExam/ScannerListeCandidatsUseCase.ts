import type { PrismaClient } from '@prisma/client';

interface ScannedCandidate {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  examScore?: number;
  confidence: 'high' | 'medium' | 'low';
}

export class ScannerListeCandidatsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string, sessionId: string, imageBase64: string, mimeType?: string): Promise<{ candidats: ScannedCandidate[]; warnings: string[] }> {
    // Vérifier la session
    const session = await (this.prisma as any).entranceExamSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    const warnings: string[] = [];

    // Appel Groq Vision pour extraire les données (même pattern que PedagogieController.scanCahier —
    // generateWithGroq() est texte seul, il faut un appel multimodal direct pour envoyer l'image réelle)
    const prompt = `Tu es un assistant d'administration scolaire camerounaise. Analyse cette image d'une liste de candidats à un concours d'entrée en 6e.

Pour chaque candidat visible, extrais :
- firstName (prénom)
- lastName (nom de famille)
- dateOfBirth (date de naissance si visible, au format YYYY-MM-DD)
- examScore (note globale ou par matière si visible)

Retourne UNIQUEMENT un JSON strict, sans markdown, avec un tableau "candidats" contenant ces champs.
Si un champ n'est pas visible ou lisible, mets-le à null.
Si l'écriture est peu lisible, mets confidence à "low" pour ce candidat.
Ne fabrique jamais de données — préfère null à une devinette.

Format attendu :
{"candidats": [{"firstName": "...", "lastName": "...", "dateOfBirth": null, "examScore": null, "confidence": "high"}]}`;

    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        warnings.push('Analyse impossible : clé Groq absente. Veuillez saisir manuellement.');
        return { candidats: [], warnings };
      }

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
            ],
          }],
          max_tokens: 2048,
          temperature: 0.1,
        }),
      });

      if (!groqRes.ok) {
        warnings.push('Erreur lors de l\'appel à l\'IA. Veuillez réessayer ou saisir manuellement.');
        return { candidats: [], warnings };
      }

      const groqData = await groqRes.json() as any;
      const response: string = groqData?.choices?.[0]?.message?.content ?? '';

      // Parser la réponse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        warnings.push('Impossible de parser la réponse de l\'IA. Veuillez réessayer avec une image plus claire.');
        return { candidats: [], warnings };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const candidats: ScannedCandidate[] = (parsed.candidats ?? []).map((c: any) => ({
        firstName: String(c.firstName ?? '').trim(),
        lastName: String(c.lastName ?? '').trim(),
        dateOfBirth: c.dateOfBirth ?? undefined,
        examScore: typeof c.examScore === 'number' ? c.examScore : undefined,
        confidence: (c.confidence as 'high' | 'medium' | 'low') ?? 'medium',
      }));

      // Vérifications
      if (candidats.length === 0) {
        warnings.push('Aucun candidat détecté dans l\'image. Vérifiez la qualité de la photo.');
      }
      const lowConfidence = candidats.filter(c => c.confidence === 'low');
      if (lowConfidence.length > 0) {
        warnings.push(`${lowConfidence.length} candidat(s) avec confiance faible — vérifiez manuellement.`);
      }

      return { candidats, warnings };
    } catch (err: any) {
      warnings.push(`Erreur lors de l'analyse : ${err.message}`);
      return { candidats: [], warnings };
    }
  }
}
