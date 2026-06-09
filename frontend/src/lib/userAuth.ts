/**
 * Déconnecte l'utilisateur : appelle POST /api/v2/users/auth/logout (efface les cookies
 * httpOnly côté serveur) puis redirige vers /login.
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/v2/users/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Même si le serveur est inaccessible, on redirige quand même
  }
  window.location.href = '/login'
}
