/**
 * DTOs et validateurs pour le module Notes
 */

export interface SaisirNoteDto {
  studentId: string;
  subjectId: string;
  classId: string;
  sequenceId: string;
  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
  coefficient?: number;
  maxValue?: number;
}

export function validerSaisirNoteDto(body: any): SaisirNoteDto {
  const erreurs: string[] = [];
  if (!body.studentId) erreurs.push('studentId requis');
  if (!body.subjectId) erreurs.push('subjectId requis');
  if (!body.classId) erreurs.push('classId requis');
  if (!body.sequenceId) erreurs.push('sequenceId requis');

  const scores = [
    'sequenceScore', 'classTestScore', 'terminalExamScore',
    'theoreticalScore', 'practicalScore', 'professionalAttitude',
    'oralScore', 'selfDevelopmentScore',
  ];
  const aUnScore = scores.some(s => body[s] !== undefined && body[s] !== null);
  if (!aUnScore) erreurs.push('Au moins un score est requis');

  if (erreurs.length > 0) throw new Error(`Données invalides : ${erreurs.join(', ')}`);

  return {
    studentId: body.studentId,
    subjectId: body.subjectId,
    classId: body.classId,
    sequenceId: body.sequenceId,
    sequenceScore: body.sequenceScore,
    classTestScore: body.classTestScore,
    terminalExamScore: body.terminalExamScore,
    theoreticalScore: body.theoreticalScore,
    practicalScore: body.practicalScore,
    professionalAttitude: body.professionalAttitude,
    oralScore: body.oralScore,
    selfDevelopmentScore: body.selfDevelopmentScore,
    coefficient: body.coefficient,
    maxValue: body.maxValue,
  };
}
