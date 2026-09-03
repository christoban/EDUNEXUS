import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerDemandeCongeUseCase } from '../../../../src/application/hr/CreerDemandeCongeUseCase';
import { TraiterDemandeCongeUseCase } from '../../../../src/application/hr/TraiterDemandeCongeUseCase';
import { ListerDemandesCongeUseCase } from '../../../../src/application/hr/ListerDemandesCongeUseCase';

class FakeLeaveRepository {
  requests: any[] = [];
  balances = new Map<string, any>();
  async createRequest(data: any) {
    const req = { id: `req-${this.requests.length + 1}`, ...data, statut: 'PENDING', validatedBy: null, validatedAt: null, createdAt: new Date() };
    this.requests.push(req);
    return req;
  }
  async findRequestByIdAndSchool(id: string, schoolId: string) {
    return this.requests.find(r => r.id === id && r.schoolId === schoolId) ?? null;
  }
  async updateRequestStatus(id: string, statut: string, validatedById: string | null) {
    const req = this.requests.find(r => r.id === id);
    if (req) { req.statut = statut; req.validatedBy = validatedById; }
    return req;
  }
  async findRequestsBySchool(schoolId: string, userId?: string) {
    return this.requests.filter(r => r.schoolId === schoolId && (!userId || r.userId === userId));
  }
  async findBalanceForYear(userId: string, annee: number) {
    return this.balances.get(`${userId}:${annee}`) ?? null;
  }
  async findLatestBalance(userId: string, schoolId: string) { return null; }
  async createBalance(data: any) {
    const bal = { id: `bal-${data.userId}-${data.annee}`, ...data, soldeInitial: 30, soldeRestant: 30, updatedAt: new Date() };
    this.balances.set(`${data.userId}:${data.annee}`, bal);
    return bal;
  }
  async upsertBalanceForYear(userId: string, schoolId: string, annee: number) {
    const existing = await this.findBalanceForYear(userId, annee);
    if (existing) return existing;
    return this.createBalance({ userId, schoolId, annee });
  }
  async decrementBalance(id: string, jours: number) {}
  async findBalancesByUser(userId: string, schoolId: string) {
    return [...this.balances.values()].filter((b: any) => b.userId === userId && b.schoolId === schoolId);
  }
}

class FakeUserRepository {
  private employees = new Map<string, any>();
  setEmployee(userId: string, schoolId: string, exists = true) {
    if (exists) this.employees.set(`${userId}:${schoolId}`, { id: userId, schoolId });
    else this.employees.delete(`${userId}:${schoolId}`);
  }
  async findEmployeeById(userId: string, schoolId: string) {
    return this.employees.get(`${userId}:${schoolId}`) ?? null;
  }
}

class FakeAudit {
  logs: any[] = [];
  journaliser(entry: any) { this.logs.push(entry); }
}

describe('CreerDemandeCongeUseCase', () => {
  let leaveRepo: FakeLeaveRepository;
  let userRepo: FakeUserRepository;
  let useCase: CreerDemandeCongeUseCase;
  beforeEach(() => {
    leaveRepo = new FakeLeaveRepository();
    userRepo = new FakeUserRepository();
    userRepo.setEmployee('emp-1', 'school-1', true);
    useCase = new CreerDemandeCongeUseCase(leaveRepo as any, userRepo as any);
  });
  it('cas nominal — crée une demande', async () => {
    const res = await useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'emp-1', type: 'CONGE_PAYE', dateDebut: new Date('2024-06-01'), dateFin: new Date('2024-06-05'), motif: 'Vacances' });
    expect(res.leaveRequest.type).toBe('CONGE_PAYE');
    expect(leaveRepo.requests).toHaveLength(1);
  });
  it('employé introuvable → throw introuvable', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'inconnu', type: 'CONGE_PAYE', dateDebut: new Date(), dateFin: new Date() })).rejects.toThrow('introuvable');
  });
  it('solde créé si absent', async () => {
    await useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'emp-1', type: 'CONGE_PAYE', dateDebut: new Date('2024-06-01'), dateFin: new Date('2024-06-02') });
    expect(leaveRepo.balances.size).toBe(1);
  });
  it('type manquant → throw requis', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'emp-1', type: '', dateDebut: new Date(), dateFin: new Date() } as any)).rejects.toThrow('requis');
  });
});

class FakeTraiterCongeService {
  constructor(private readonly leaveRepo: FakeLeaveRepository) {}
  async traiterDemandeConge(schoolId: string, requestId: string, statut: 'APPROVED' | 'REJECTED', validatedById: string | undefined) {
    const req = await this.leaveRepo.findRequestByIdAndSchool(requestId, schoolId);
    if (!req) throw new Error('Demande de congé introuvable');
    if (req.statut !== 'PENDING') throw new Error('La demande a déjà été traitée');
    const updated = await this.leaveRepo.updateRequestStatus(requestId, statut, validatedById ?? null);
    if (statut === 'APPROVED') {
      const year = new Date(req.dateDebut).getFullYear();
      const bal = await this.leaveRepo.upsertBalanceForYear(req.userId, schoolId, year);
      const days = Math.max(0, Math.round((new Date(req.dateFin).getTime() - new Date(req.dateDebut).getTime()) / 86400000)) + 1;
      await this.leaveRepo.decrementBalance(bal.id, days);
    }
    return { id: updated.id, statut: updated.statut };
  }
}

describe('TraiterDemandeCongeUseCase', () => {
  let leaveRepo: FakeLeaveRepository;
  let audit: FakeAudit;
  let useCase: TraiterDemandeCongeUseCase;
  beforeEach(() => {
    leaveRepo = new FakeLeaveRepository();
    audit = new FakeAudit();
    const fakeService = new FakeTraiterCongeService(leaveRepo);
    useCase = new TraiterDemandeCongeUseCase(fakeService as any, audit as any);
    leaveRepo.requests.push({ id: 'req-1', schoolId: 'school-1', userId: 'emp-1', type: 'CONGE_PAYE', dateDebut: new Date('2024-06-01'), dateFin: new Date('2024-06-02'), statut: 'PENDING', validatedBy: null });
  });
  it('APPROVED nominal', async () => {
    const res = await useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', leaveRequestId: 'req-1', statut: 'APPROVED' });
    expect(res.leaveRequest.statut).toBe('APPROVED');
    expect(audit.logs.some(l => l.outcome === 'SUCCES')).toBe(true);
  });
  it('statut invalide → throw', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', leaveRequestId: 'req-1', statut: 'PENDING' as any })).rejects.toThrow('APPROVED ou REJECTED');
  });
  it('demande déjà traitée → throw 409', async () => {
    await useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', leaveRequestId: 'req-1', statut: 'APPROVED' });
    await expect(useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', leaveRequestId: 'req-1', statut: 'REJECTED' })).rejects.toThrow('déjà été traitée');
    expect(audit.logs.some(l => l.outcome === 'ERREUR')).toBe(true);
  });
  it('demande introuvable → throw', async () => {
    await expect(useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', leaveRequestId: 'inconnu', statut: 'APPROVED' })).rejects.toThrow('introuvable');
  });
});

describe('ListerDemandesCongeUseCase', () => {
  let leaveRepo: FakeLeaveRepository;
  let userRepo: FakeUserRepository;
  let useCase: ListerDemandesCongeUseCase;
  beforeEach(() => {
    leaveRepo = new FakeLeaveRepository();
    userRepo = new FakeUserRepository();
    userRepo.setEmployee('emp-1', 'school-1', true);
    useCase = new ListerDemandesCongeUseCase(leaveRepo as any, userRepo as any);
    leaveRepo.requests.push({ id: 'req-1', schoolId: 'school-1', userId: 'emp-1', statut: 'PENDING' });
    leaveRepo.requests.push({ id: 'req-2', schoolId: 'school-1', userId: 'emp-2', statut: 'PENDING' });
  });
  it('liste sans filtre', async () => {
    const res = await useCase.lister({ schoolId: 'school-1', demandeurId: 'admin-1' });
    expect(res.leaveRequests).toHaveLength(2);
  });
  it('liste avec filtre userId', async () => {
    const res = await useCase.lister({ schoolId: 'school-1', demandeurId: 'admin-1', filtreUserId: 'emp-1' });
    expect(res.leaveRequests).toHaveLength(1);
  });
  it('obtenirSolde — employé introuvable → throw', async () => {
    await expect(useCase.obtenirSolde({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'inconnu' })).rejects.toThrow('introuvable');
  });
});
