import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { UserRole } from '@domain/types/enums';

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();

  ajouter(user: User): void { this.store.set(user.id, user); }

  async findById(id: string): Promise<User | null> { return this.store.get(id) ?? null; }

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

  async existsByEmail(email: string, schoolId: string): Promise<boolean> {
    return [...this.store.values()].some(u => u.email === email && u.schoolId === schoolId);
  }

  async save(user: User): Promise<void> { this.store.set(user.id, user); }
  async update(user: User): Promise<void> { this.store.set(user.id, user); }
  async delete(id: string): Promise<void> { this.store.delete(id); }

  async findByIdWithRefreshVersion(id: string): Promise<{ user: User; refreshTokenVersion: number } | null> {
    const user = this.store.get(id);
    if (!user) return null;
    return { user, refreshTokenVersion: user.toObject().refreshTokenVersion };
  }

  async authentifier(email: string, schoolId: string, _plainPassword: string, role?: string): Promise<User | null> {
    return [...this.store.values()].find(u => u.email === email && u.schoolId === schoolId && (!role || u.role === role)) ?? null;
  }

  async listerRolesAvecMotDePasse(email: string, schoolId: string, _plainPassword: string): Promise<string[]> {
    return [...this.store.values()].filter(u => u.email === email && u.schoolId === schoolId).map(u => u.role);
  }

  async saveAvecProfil(user: User, _profilData: any): Promise<void> {
    this.store.set(user.id, user);
  }

  async mettreAJourAvecProfil(userId: string, _data: any): Promise<void> {
    // stub
  }

  async supprimerAvecCascade(userId: string): Promise<void> {
    this.store.delete(userId);
  }

  async transfererEleve(_params: any): Promise<void> {
    // stub
  }
}
