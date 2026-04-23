import React from 'react';
import DashboardSuperAdmin from './DashboardSuperAdmin';

// Simule l’utilisateur connecté (à remplacer par auth réelle)
const currentUser = {
  email: 'ndzana.christophe@edunexus.cm',
  role: 'superadmin',
  name: 'Ndzana Christophe',
};

const isSuperAdmin =
  currentUser &&
  currentUser.role === 'superadmin' &&
  currentUser.name.toLowerCase().includes('ndzana');

const ProtectedSuperAdmin: React.FC = () => {
  if (!isSuperAdmin) {
    return (
      <div style={{
        maxWidth: 480,
        margin: '80px auto',
        background: '#fff3f3',
        border: '1px solid #eb3b5a',
        borderRadius: 12,
        padding: 32,
        textAlign: 'center',
        color: '#eb3b5a',
        fontSize: '1.1rem',
      }}>
        <strong>Accès refusé</strong>
        <div style={{ marginTop: 12 }}>
          Seul l’administrateur principal (Ndzana Christophe) peut accéder à ce tableau de bord.<br />
          Si vous pensez qu’il s’agit d’une erreur, contactez le support EduNexus.
        </div>
      </div>
    );
  }
  return <DashboardSuperAdmin />;
};

export default ProtectedSuperAdmin;
