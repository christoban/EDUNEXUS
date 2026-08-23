import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole } from '@domain/types/enums';

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  private classesParEleve = new Map<string, string>();
  private parentsParEleve = new Map<string, Set<string>>();

  ajouter(user: User): void {
    this.store.set(user.id, user);
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  definirParentsEleve(studentId: string, parentIds: string[]): void {
    this.parentsParEleve.set(studentId, new Set(parentIds));
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(u => u.email === email && u.schoolId === schoolId) ?? null;
  }

  async findByPhone(phone: string, schoolId: string): Promise<User | null> {
    return [...this.store.values()].find(u => u.phone === phone && u.schoolId === schoolId) ?? null;
  }

  async findBySchool(schoolId: string): Promise<User[]> {
    return [...this.store.values()].filter(u => u.schoolId === schoolId);
  }

  async findByRole(schoolId: string, role: UserRole): Promise<User[]> {
    return [...this.store.values()].filter(u => u.schoolId === schoolId && u.role === role);
  }

  async findByClass(schoolId: string, classId: string): Promise<User[]> {
    return [...this.store.values()].filter(
      user =>
        user.schoolId === schoolId &&
        user.role === 'STUDENT' &&
        this.classesParEleve.get(user.id) === classId
    );
  }

  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    return [...this.store.values()].some(u => u.email === email && u.schoolId === schoolId);
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
      u => u.email === email && u.schoolId === schoolId && (!role || u.role === role)
    ) ?? null;
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, _plainPassword: string): Promise<string[]> {
    return [...this.store.values()]
      .filter(u => u.email === email && u.schoolId === schoolId)
      .map(u => u.role);
  }

  async saveAvecProfil(user: User, _profilData: any): Promise<void> {
    this.store.set(user.id, user);
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
    this.store.delete(userId);
  }

  async restaurer(_userId: string): Promise<void> {
    // stub — User entity n'a pas deletedAt dans le domaine
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
      .filter(user => parentIds.has(user.id) && user.email !== undefined)
      .map(user => user.email!);
  }
}
