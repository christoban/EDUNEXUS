import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Garde-fou P1 (architecture hexagonale, §4.3 AGENTS.md) :
 * la couche `application/` ne doit JAMAIS dépendre de Prisma — ni par import de
 * `@prisma/client`, ni par un accès direct `this.prisma.` / `ctx.prisma.`.
 *
 * Ce test échoue si une telle dépendance réapparaît. Il rend la règle exécutable
 * plutôt que documentaire (chantier P1, Vague 13.4).
 */

const APPLICATION_DIR = join(import.meta.dir, '../../src/application');

// Motifs interdits : l'import Prisma + les accès directs typés (le cas `prisma: any`
// de l'ancien module pushNotification était invisible au grep d'import mais visible ici).
const MOTIFS_INTERDITS = ['@prisma/client', 'this.prisma', 'ctx.prisma'];

function listerFichiersTs(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const chemin = join(dir, entry);
    if (statSync(chemin).isDirectory()) {
      result.push(...listerFichiersTs(chemin));
    } else if (entry.endsWith('.ts')) {
      result.push(chemin);
    }
  }
  return result;
}

describe('P1 — garde-fou : application/ ne dépend pas de Prisma', () => {
  it("aucun fichier de application/ n'importe @prisma/client ni n'utilise prisma directement", () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(APPLICATION_DIR)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const motif of MOTIFS_INTERDITS) {
        if (contenu.includes(motif)) {
          violations.push(`${relative(APPLICATION_DIR, fichier)} → "${motif}"`);
        }
      }
    }
    expect(
      violations,
      `Dépendances Prisma interdites détectées dans application/ :\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
