await this.emailService.envoyer({
  destinataire: params.email,
  sujet: `Liste d'anonymisation – ${params.schoolName}`,
  contenuHtml: `...lien ${params.listUrl}...`,
  contenuTexte: `...`,
  eventType: 'anonymat_team_invite',
  metadata: {}, // ou { schoolId } si tu l’ajoutes au port plus tard
});