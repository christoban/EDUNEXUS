const AdminDashboard = () => {
  return (
    <main className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue dans votre espace administrateur.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["Élèves", "Classes", "Enseignants", "Notes en attente"].map((label) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">0</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Actions rapides</h2>
        <div className="grid gap-2">
          {[
            { label: "Gérer les utilisateurs", href: "/admin/users" },
            { label: "Gérer les classes", href: "/admin/classes" },
            { label: "Gérer les matières", href: "/admin/subjects" },
            { label: "Paramètres", href: "/admin/settings" },
          ].map((a) => (
            <a key={a.href} href={a.href}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted transition-colors">
              {a.label}
              <span>→</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
};

export default AdminDashboard;
