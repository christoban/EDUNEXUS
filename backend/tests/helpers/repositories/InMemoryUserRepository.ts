import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole } from '@domain/types/enums';

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  private classesParEleve = new Map<string, string>();
  private parentsParEleve = new Map<string, Set<string>>();
  private utilisateursSupprimes = new Set<string>();

  ajouter(user: User): void {
    this.store.set(user.id, user);
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  definirParentsEleve(studentId: string, parentIds: string[]): void {
    this.parentsParEleve.set(studentId, new Set(parentIds));
  }

  private estActif(user: User): boolean {
    return !this.utilisateursSupprimes.has(user.id);
  }

  async findById(id: string): Promise<User | null> {
    const user = this.store.get(id);
    return user && this.estActif(user) ? user : null;
  }

  async findByEmail(email: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findByPhone(phone: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.phone === phone && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findByPhoneContient(phoneFragment: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => (u.phone ?? '').includes(phoneFragment) && u.schoolId === schoolId && this.estActif(u)
    ) ?? null;
  }

  async findBySchool(schoolId: string): Promise<User[]> {
    return [...this.store.values()].filter(u => u.schoolId === schoolId && this.estActif(u));
  }

  async findByRole(schoolId: string, role: UserRole): Promise<User[]> {
    return [...this.store.values()].filter(
      u => u.schoolId === schoolId && u.role === role && this.estActif(u)
    );
  }

  async findByClass(schoolId: string, classId: string): Promise<User[]> {
    return [...this.store.values()].filter(
      user =>
        user.schoolId === schoolId &&
        user.role === 'STUDENT' &&
        this.classesParEleve.get(user.id) === classId &&
        this.estActif(user)
    );
  }

  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    return [...this.store.values()].some(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u)
    );
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null> {
    const user = this.store.get(id);
    if (!user) return null;
    return { user, refreshTokenVersion: user.toObject().refreshTokenVersion };
  }

  async authentifier(email: string, schoolId: string, _plainPassword: string, role?: string): Promise<User | null> {
    return [...this.store.values()].find(
      u => u.email === email && u.schoolId === schoolId && this.estActif(u) && (!role || u.role === role)
    ) ?? null;
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, _plainPassword: string): Promise<string[]> {
    return [...this.store.values()]
      .filter(u => u.email === email && u.schoolId === schoolId && this.estActif(u))
      .map(u => u.role);
  }

  async saveAvecProfil(user: User, profilData: {
    passwordHash: string;
    staffTitle?: string;
    specializations?: string[];
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
    parentOfStudentIds?: string[];
  }): Promise<void> {
    this.store.set(user.id, user);

    if (profilData.classeId !== undefined) {
      this.classesParEleve.set(user.id, profilData.classeId);
    }
  }

  async mettreAJourAvecProfil(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    email?: string;
    isActive?: boolean;
    passwordHash?: string;
    subjectIds?: string[];
    classeId?: string;
    dateOfBirth?: Date;
    gender?: string;
  }): Promise<void> {
    const user = this.store.get(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    const props = user.toObject();
    this.store.set(
      userId,
      User.reconstituer({
        ...props,
        firstName: data.firstName ?? props.firstName,
        lastName: data.lastName ?? props.lastName,
        phone: data.phone ?? props.phone,
        avatarUrl: data.avatarUrl ?? props.avatarUrl,
        email: data.email ?? props.email,
        isActive: data.isActive ?? props.isActive,
      })
    );

    if (data.classeId !== undefined) {
      this.classesParEleve.set(userId, data.classeId);
    }
  }

  async supprimerAvecCascade(userId: string): Promise<void> {
    if (!this.store.has(userId)) {
      throw new Error('Utilisateur introuvable');
    }
    this.utilisateursSupprimes.add(userId);
  }

  async restaurer(userId: string): Promise<void> {
    if (!this.store.has(userId)) {
      throw new Error('Utilisateur introuvable');
    }
    this.utilisateursSupprimes.delete(userId);
  }

  async transfererEleve(params: {
    studentId: string;
    fromClasseId: string;
    toClasseId: string;
    demandeurId: string;
    schoolId: string;
  }): Promise<void> {
    const user = this.store.get(params.studentId);
    if (!user) {
      throw new Error('Élève introuvable');
    }
    if (user.schoolId !== params.schoolId || user.role !== 'STUDENT') {
      throw new Error('Élève introuvable');
    }

    this.classesParEleve.set(params.studentId, params.toClasseId);
  }

  async findEmailsParentsParEleve(studentId: string): Promise<string[]> {
    const parentIds = this.parentsParEleve.get(studentId) ?? new Set();

    return [...this.store.values()]
      .filter(user => parentIds.has(user.id) && user.email !== undefined && this.estActif(user))
      .map(user => user.email!);
  }

  async findAuthDataById(_id: string) { return null; }
  async saveLoginEmailOtp(_id: string, _data: { hash: string; expiresAt: Date }): Promise<void> {}
  async incrementLoginEmailOtpAttempts(_id: string): Promise<void> {}
  async clearLoginEmailOtp(_id: string): Promise<void> {}
  async updateMfaRecoveryCodeHashes(_id: string, _hashes: string[]): Promise<void> {}
}
