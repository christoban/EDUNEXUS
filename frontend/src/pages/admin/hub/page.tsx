import React, { useState } from "react";
import Topbar from "../components/Topbar";
import StatCard from "./components/StatCard";
import SearchBar from "./components/SearchBar";
import EtablissementTable from "./components/EtablissementTable";

const HUB_STATUSES = [
  { key: "pending", label: "PENDING" },
  { key: "rejected", label: "REJECTED" },
  { key: "approved", label: "APPROVED" },
  { key: "active", label: "ACTIVE" },
] as const;

type StatusKey = typeof HUB_STATUSES[number]["key"];

const mockEtablissements = [
  { id: "1", name: "Lycée Condorcet de Douala", type: "Secondaire francophone", plan: "Premium", users: 120, lastLogin: "il y a 2h", status: "active" },
  { id: "2", name: "Collège Espoir Yaoundé", type: "Secondaire anglophone", plan: "Standard", users: 80, lastLogin: "il y a 1h", status: "pending" },
  { id: "3", name: "École Bilingue Bonapriso", type: "Bilingue", plan: "Premium", users: 60, lastLogin: "il y a 3h", status: "approved" },
  { id: "4", name: "Institut Technique Douala", type: "Technique / Professionnel", plan: "Non éligible", users: 30, lastLogin: "il y a 5h", status: "rejected" },
  { id: "5", name: "École Maternelle Les Petits", type: "Maternelle", plan: "Standard", users: 45, lastLogin: "il y a 4h", status: "active" },
  { id: "6", name: "Lycée Moderne Kribi", type: "Secondaire francophone", plan: "Premium", users: 110, lastLogin: "il y a 2h", status: "pending" },
  { id: "7", name: "École Primaire Douala", type: "Primaire francophone", plan: "Standard", users: 70, lastLogin: "il y a 6h", status: "active" },
  { id: "8", name: "Collège Technique Yaoundé", type: "Technique / Professionnel", plan: "Non éligible", users: 25, lastLogin: "il y a 7h", status: "rejected" },
  { id: "9", name: "École Bilingue Akwa", type: "Bilingue", plan: "Premium", users: 90, lastLogin: "il y a 1h", status: "approved" },
  { id: "10", name: "École Primaire Bonanjo", type: "Primaire anglophone", plan: "Standard", users: 55, lastLogin: "il y a 8h", status: "active" },
];

const HubPage: React.FC = () => {
  const [selected, setSelected] = useState<StatusKey>("active");
  const [search, setSearch] = useState("");

  // Calcul des stats dynamiques
  const stats = HUB_STATUSES.reduce((acc, s) => {
    acc[s.key] = mockEtablissements.filter(e => e.status === s.key).length;
    return acc;
  }, {} as Record<StatusKey, number>);

  // Actions mockées
  const handleAction = (id: string, action: string) => {
    alert(`Action "${action}" sur établissement #${id}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <Topbar onInviteClick={() => alert("TODO: ouvrir la modale d'invitation")}/>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 40px" }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text1)", margin: 0 }}>Hub de Contrôle</h1>
          <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 6 }}>Gestion centralisée des établissements camerounais</div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
          {HUB_STATUSES.map((stat) => (
            <StatCard
              key={stat.key}
              label={stat.label}
              value={stats[stat.key]}
              color={stat.key as StatusKey}
              selected={selected === stat.key}
              onClick={() => setSelected(stat.key as StatusKey)}
            />
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} />
        <EtablissementTable
          etablissements={mockEtablissements}
          status={selected}
          search={search}
          onAction={handleAction}
        />
      </main>
    </div>
  );
};

export default HubPage;
