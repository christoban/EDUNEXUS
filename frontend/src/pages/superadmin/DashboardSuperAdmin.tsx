import React, { useState } from 'react';
import './superadmin.css';
import InviteSchoolForm from './InviteSchoolForm';
import AuditLog from './AuditLog';
import SchoolsTable from './SchoolsTable';

const DashboardSuperAdmin: React.FC = () => {
  // Centralise la liste des établissements (mock + ajout dynamique)
  const [schools, setSchools] = useState([
    {
      id: 1,
      name: "Collège Lumière",
      type: "Secondaire",
      email: "directeur@lumieresec.cm",
      status: "Pending",
    },
    {
      id: 2,
      name: "École Espoir",
      type: "Primaire",
      email: "contact@espoirecole.cm",
      status: "Active",
    },
    {
      id: 3,
      name: "Lycée Moderne",
      type: "Lycée",
      email: "proviseur@lyceemoderne.cm",
      status: "Approved",
    },
  ]);

  // Centralise le journal d’audit
  const [auditLog, setAuditLog] = useState<string[]>([
    "Invitation envoyée à directeur@lumieresec.cm",
    "Inscription effectuée par École Espoir",
    "Validation de Collège Lumière",
    "Activation de Lycée Moderne",
  ]);

  // Ajoute une invitation (statut Pending) et log d’audit
  const handleInvite = (email: string) => {
    setSchools(prev => [
      ...prev,
      {
        id: prev.length + 1,
        name: "",
        type: "",
        email,
        status: "Pending",
      },
    ]);
    setAuditLog(prev => [
      `Invitation envoyée à ${email}`,
      ...prev,
    ]);
  };

  // Actions sur les établissements
  const handleAction = (id: number, action: 'approve' | 'reject' | 'suspend' | 'delete') => {
    setSchools(prev => prev.map(school => {
      if (school.id !== id) return school;
      if (action === 'approve') return { ...school, status: 'Approved' };
      if (action === 'reject') return { ...school, status: 'Rejected' };
      if (action === 'suspend') return { ...school, status: 'Suspended' };
      return school;
    }).filter(school => !(school.id === id && action === 'delete')));

    let actionLabel = '';
    if (action === 'approve') actionLabel = 'Établissement validé';
    if (action === 'reject') actionLabel = 'Établissement refusé';
    if (action === 'suspend') actionLabel = 'Établissement suspendu';
    if (action === 'delete') actionLabel = 'Établissement supprimé';
    const school = schools.find(s => s.id === id);
    setAuditLog(prev => [
      `${actionLabel}${school && school.email ? ` (${school.email})` : ''}`,
      ...prev,
    ]);
  };

  return (
    <div className="superadmin-dashboard">
      <header>
        <h1>Tableau de bord Super Admin</h1>
        <p>Bienvenue, Ndzana Christophe</p>
      </header>
      <section>
        <InviteSchoolForm onInvite={handleInvite} />
      </section>
      <section>
        <SchoolsTable schools={schools} onAction={handleAction} />
      </section>
      <section>
        <AuditLog auditLog={auditLog} />
      </section>
    </div>
  );
};

export default DashboardSuperAdmin;
