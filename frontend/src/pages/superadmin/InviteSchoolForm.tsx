import React, { useState } from 'react';

interface Props {
  onInvite?: (email: string) => void;
}

const InviteSchoolForm: React.FC<Props> = ({ onInvite }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simule une API d’envoi d’invitation
  const sendInvitation = async (email: string) => {
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200)); // Simule un délai réseau
      if (!email.endsWith('.cm')) throw new Error("L’email doit être camerounais (.cm)");
      setSuccess("Invitation envoyée avec succès à " + email);
      if (onInvite) onInvite(email);
      setEmail('');
    } catch (e: any) {
      setError(e.message || "Erreur lors de l’envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sendInvitation(email);
  };

  return (
    <form className="invite-school-form" onSubmit={handleSubmit}>
      <h2>Inviter un établissement</h2>
      <label htmlFor="invite-email">Email du responsable</label>
      <input
        id="invite-email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="exemple@ecole.cm"
        required
        autoComplete="email"
        disabled={loading}
      />
      <button type="submit" disabled={loading || !email}>
        {loading ? 'Envoi en cours…' : "Envoyer l'invitation"}
      </button>
      {success && <div style={{ color: '#20bf6b', marginTop: 10 }}>{success}</div>}
      {error && <div style={{ color: '#eb3b5a', marginTop: 10 }}>{error}</div>}
    </form>
  );
};

export default InviteSchoolForm;
