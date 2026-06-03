import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ContactForm {
  school: string;
  email: string;
  phone: string;
  message: string;
}

const FEATURES = [
  {
    icon: "🛡️",
    color: "#7c3aed",
    colorBg: "rgba(124,58,237,0.12)",
    title: "Intelligence artificielle",
    desc: "Prédiction d'échec, génération d'examens, emploi du temps automatique et recommandations contextuelles.",
  },
  {
    icon: "💳",
    color: "#eab308",
    colorBg: "rgba(234,179,8,0.12)",
    title: "Paiement Mobile Money",
    desc: "MTN Mobile Money et Orange Money intégrés nativement. Reçus automatiques et relances intelligentes.",
  },
  {
    icon: "💬",
    color: "#3b82f6",
    colorBg: "rgba(59,130,246,0.12)",
    title: "Communication structurée",
    desc: "Messagerie privée, canaux classe, canal parents et notifications système automatiques.",
  },
  {
    icon: "📊",
    color: "#ec4899",
    colorBg: "rgba(236,72,153,0.12)",
    title: "Analytics avancées",
    desc: "Tableaux de bord par élève, rapports mensuels PDF, suivi de performance par classe et par élève.",
  },
  {
    icon: "📶",
    color: "#f97316",
    colorBg: "rgba(249,115,22,0.12)",
    title: "Mode hors ligne",
    desc: "Saisie de présences et de notes sans internet. Synchronisation automatique à la reconnexion.",
  },
  {
    icon: "🔒",
    color: "#22c55e",
    colorBg: "rgba(34,197,94,0.12)",
    title: "Multi-tenant sécurisé",
    desc: "Chaque école a son espace isolé, son sous-domaine propre et ses données protégées.",
  },
];

const STATS = [
  { value: "50+", label: "Établissements" },
  { value: "5 000+", label: "Élèves suivis" },
  { value: "100%", label: "Sécurité" },
  { value: "24/7", label: "Support" },
];

const CONTACT_INFO = [
  { icon: "✉", label: "Email", value: "christoban2005@gmail.com", color: "#3b82f6" },
  { icon: "📱", label: "Téléphone / WhatsApp", value: "+237 695 557 891", color: "#22c55e" },
  { icon: "📍", label: "Localisation", value: "Yaoundé, Cameroun", color: "#f97316" },
  { icon: "👤", label: "Administrateur principal", value: "Ndzana Christophe", color: "#7c3aed" },
];

function Navbar() {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,13,20,0.92)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 80px", height: 60,
    }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <svg width="28" height="28" viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
        </svg>
        <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 24, letterSpacing: "-0.5px" }}>
          EduNexus
        </span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {["Fonctionnalités", "Tarifs", "À propos", "Contact"].map((link) => (
          <a
            key={link}
            href={`#${link.toLowerCase().replace("à", "a")}`}
            style={{ color: "#cbd5e1", fontSize: 18, textDecoration: "none", transition: "color .2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
          >
            {link}
          </a>
        ))}
        <a
          href="/login"
          style={{
            background: "#3b82f6", color: "#fff", fontSize: 17, fontWeight: 600,
            padding: "8px 20px", borderRadius: 8, textDecoration: "none",
            transition: "background .2s", display: "inline-block",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
        >
          Se connecter
        </a>
      </div>
    </nav>
  );
}

function DashboardWidget() {
  return (
    <div style={{
      background: "#111827", border: "1px solid #1f2937",
      borderRadius: 14, padding: 28, minWidth: 340, maxWidth: 360,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
          boxShadow: "0 0 6px #22c55e", display: "inline-block",
        }} />
        <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>
          Dashboard — Lycée Condorcet
        </span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ color: "#64748b", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>
          Élèves actifs
        </p>
        <p style={{ color: "#fff", fontSize: 42, fontWeight: 800, margin: "0 0 6px", lineHeight: 1 }}>
          1 250
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ color: "#22c55e", fontSize: 14 }}>52% réussite</span>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>86 enseignants</span>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #1f2937", margin: "16px 0" }} />

      <div style={{
        background: "#1c1008", borderLeft: "3px solid #f97316",
        borderRadius: "0 8px 8px 0", padding: "12px 16px", marginBottom: 12,
      }}>
        <p style={{ color: "#f97316", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px", fontWeight: 600 }}>
          Alerte IA
        </p>
        <p style={{ color: "#fb923c", fontSize: 14, margin: 0 }}>
          3 élèves en risque d'échec détectés
        </p>
      </div>

      <div style={{
        background: "#0a1f0e", borderLeft: "3px solid #22c55e",
        borderRadius: "0 8px 8px 0", padding: "12px 16px",
      }}>
        <p style={{ color: "#22c55e", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px", fontWeight: 600 }}>
          Paiements reçus
        </p>
        <p style={{ color: "#4ade80", fontSize: 24, fontWeight: 800, margin: 0 }}>
          98 500 000 FCFA
        </p>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section style={{
      padding: "clamp(100px,10vh,140px) 0 clamp(60px,7vh,100px)",
      background: "radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.06) 0%, transparent 60%)",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 80, maxWidth: 1200, margin: "0 auto", alignItems: "center" }}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center",
            background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
            borderRadius: 999, padding: "7px 18px", marginBottom: 32,
          }}>
            <span style={{ color: "#60a5fa", fontSize: 14, fontWeight: 500 }}>
              Plateforme SaaS multi-établissements
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(42px,5vw,68px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 24px", color: "#fff", letterSpacing: "-1.5px" }}>
            La plateforme{" "}
            <span style={{ color: "#3b82f6", fontStyle: "italic" }}>intelligente</span>
            <br />pour une école
            <br />connectée
          </h1>

          <p style={{ color: "#94a3b8", fontSize: 20, lineHeight: 1.7, maxWidth: 480, margin: "0 0 40px" }}>
            Gérez vos établissements scolaires, suivez les performances,
            communiquez efficacement et améliorez la réussite de chaque élève
            grâce à l'intelligence artificielle. Conçue pour le Cameroun.
          </p>

          <div style={{ display: "flex", gap: 16 }}>
            <button style={{
              background: "#3b82f6", color: "#fff", border: "none",
              borderRadius: 8, padding: "14px 30px", fontSize: 18, fontWeight: 600,
              cursor: "pointer", transition: "background .2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
            >
              Demander une démo
            </button>
            <a href="#tarifs" style={{
              background: "transparent", color: "#e2e8f0",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "14px 30px", fontSize: 18, fontWeight: 500,
              textDecoration: "none", display: "inline-block",
            }}>
              Voir les tarifs
            </a>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, auto)",
            justifyContent: "flex-start", gap: "clamp(24px,4vw,48px)",
            marginTop: 48, paddingTop: 32,
            borderTop: "1px solid #1f2937",
          }}>
            {STATS.map((stat, i) => (
              <div key={i}>
                <p style={{ color: "#fff", fontSize: 46, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-1px" }}>
                  {stat.value}
                </p>
                <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <DashboardWidget />
        </div>
      </div>
    </section>
  );
}



function FeaturesSection() {
  return (
    <section id="fonctionnalites" style={{ padding: "80px 80px", background: "#0a0d14" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ color: "#3b82f6", fontSize: 15, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
          Fonctionnalités
        </p>
        <h2 style={{ color: "#fff", fontSize: 46, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-1px" }}>
          Tout ce dont votre école a besoin
        </h2>
        <p style={{ color: "#64748b", fontSize: 20, margin: "0 0 50px" }}>
          Une Suite complète d'outils pensés pour le contexte camerounais et africain
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {FEATURES.map((feat, i) => (
            <div key={i} style={{
              background: "#111827", border: "1px solid #1f2937",
              borderTop: `3px solid ${feat.color}`,
              borderRadius: 12, padding: 28,
              transition: "all 0.25s ease",
              boxShadow: "none",
            }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(-3px)";
                el.style.borderColor = feat.color;
                el.style.boxShadow = `0 -1px 8px -2px ${feat.color}, 0 8px 32px -8px ${feat.color}40`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = "translateY(0)";
                el.style.borderColor = "#1f2937";
                el.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 10,
                background: feat.colorBg, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 20, marginBottom: 16, lineHeight: 1,
              }}>
                {feat.icon}
              </div>
              <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 10px" }}>
                {feat.title}
              </h3>
              <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: "Découverte",
      price: "Gratuit",
      period: "/ 3 mois",
      limit: "Jusqu'à 100 élèves",
      features: ["Gestion académique de base", "Notes et présences", "Bulletins automatiques"],
      featured: false,
    },
    {
      name: "Standard",
      price: "15 000",
      currency: "FCFA",
      period: "/ mois",
      limit: "Jusqu'à 500 élèves",
      features: ["Tout Découverte inclus", "Finance + Mobile Money", "Communication avancée", "Support prioritaire"],
      featured: true,
    },
    {
      name: "Premium",
      price: "35 000",
      currency: "FCFA",
      period: "/ mois",
      limit: "Élèves illimités",
      features: ["Tout Standard inclus", "IA complète + prédictions", "Mode offline", "Rapport mensuel auto"],
      featured: false,
    },
  ];

  return (
    <section id="tarifs" style={{ padding: "80px 80px", background: "#0d1117" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ color: "#3b82f6", fontSize: 15, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
          Tarifs
        </p>
        <h2 style={{ color: "#fff", fontSize: 46, fontWeight: 800, margin: "0 0 60px", letterSpacing: "-1px" }}>
          Des plans adaptés à chaque établissement
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "stretch" }}>
          {plans.map((plan, i) => (
            <div key={i} style={{
              background: plan.featured ? "#0f1724" : "#111827",
              border: plan.featured ? "2px solid #3b82f6" : "1px solid #1f2937",
              borderRadius: 14, padding: 32,
              boxShadow: plan.featured ? "0 0 40px rgba(59,130,246,0.15)" : "none",
              position: "relative", display: "flex", flexDirection: "column",
            }}>
              {plan.featured && (
                <div style={{
                  position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                  background: "#3b82f6", color: "#fff", fontSize: 15, fontWeight: 600,
                  padding: "4px 16px", borderRadius: 999, whiteSpace: "nowrap",
                }}>
                  Le plus populaire
                </div>
              )}

              <h3 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>
                {plan.name}
              </h3>

              <div style={{ marginBottom: 8, overflow: "hidden" }}>
                <span style={{ color: "#fff", fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, letterSpacing: "-2px", whiteSpace: "nowrap", display: "inline-block" }}>
                  {plan.price}
                </span>
                {plan.currency && (
                  <span style={{ color: "#94a3b8", fontSize: 19, fontWeight: 500, marginLeft: 6 }}>
                    {plan.currency}
                  </span>
                )}
                <span style={{ color: "#64748b", fontSize: 17, marginLeft: 4 }}>{plan.period}</span>
              </div>

              <p style={{ color: "#64748b", fontSize: 15, margin: "0 0 24px" }}>{plan.limit}</p>

              <hr style={{ border: "none", borderTop: "1px solid #1f2937", margin: "0 0 20px" }} />

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", flex: 1 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ color: "#22c55e", fontSize: 15, fontWeight: 700 }}>✓</span>
                    <span style={{ color: "#94a3b8", fontSize: 15 }}>{f}</span>
                  </li>
                ))}
              </ul>

              <button style={{
                width: "100%", padding: "14px 0", borderRadius: 8, fontSize: 15, fontWeight: 600,
                cursor: "pointer", border: plan.featured ? "none" : "1px solid #3d4f6b",
                background: plan.featured ? "#3b82f6" : "rgba(255,255,255,0.04)",
                color: plan.featured ? "#fff" : "#e2e8f0",
                transition: "all .2s", marginTop: "auto",
              }}>
                {plan.featured ? "Commencer maintenant" : "Choisir ce plan"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const [form, setForm] = useState<ContactForm>({ school: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleChange = (field: keyof ContactForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.school.trim() || !form.email.trim()) {
      toast.error("Veuillez remplir le nom de l'établissement et l'email.");
      return;
    }

    setSending(true);
    try {
      const response = await api.post("/public/contact-request", form);
      toast.success(response.data.message || "Demande envoyée avec succès!");
      setForm({ school: "", email: "", phone: "", message: "" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1f2d45", border: "1px solid #2e4060",
    borderRadius: 8, padding: "13px 16px", color: "#e2e8f0", fontSize: 15,
    outline: "none", boxSizing: "border-box", transition: "border-color .2s, background .2s",
  };

  const labelStyle: React.CSSProperties = {
    color: "#64748b", fontSize: 13, letterSpacing: "0.1em",
    textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 6,
  };

  return (
    <section id="contact" style={{ padding: "80px 80px", background: "#0a0d14" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, maxWidth: 1100, margin: "0 auto", alignItems: "start" }}>
        <div>
          <h2 style={{ color: "#fff", fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, margin: "0 0 16px", letterSpacing: "-1px" }}>
            Intéressé par EduNexus&nbsp;?
          </h2>
          <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.7, margin: "0 0 40px", maxWidth: 420 }}>
            Contactez l'administrateur principal pour obtenir une invitation et
            rejoindre la plateforme. Toute école doit passer par le processus
            d'invitation officiel.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {CONTACT_INFO.map((info, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: `${info.color}18`,
                  border: `1px solid ${info.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0,
                }}>
                  {info.icon}
                </div>
                <div>
                  <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 2px", fontWeight: 500 }}>
                    {info.label}
                  </p>
                  <p style={{ color: "#e2e8f0", fontSize: 16, margin: 0, fontWeight: 500 }}>
                    {info.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: "#111827", border: "1px solid #1f2937",
          borderRadius: 16, padding: 36,
        }}>
          <h3 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "0 0 28px" }}>
            Envoyer une demande de contact
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Nom de l'établissement</label>
              <input
                style={inputStyle}
                placeholder="Lycée de la Réussite"
                value={form.school}
                onChange={handleChange("school")}
              />
            </div>
            <div>
              <label style={labelStyle}>Email du responsable</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="directeur@ecole.cm"
                value={form.email}
                onChange={handleChange("email")}
              />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input
                style={inputStyle}
                placeholder="+237 6XX XXX XXX"
                value={form.phone}
                onChange={handleChange("phone")}
              />
            </div>
            <div>
              <label style={labelStyle}>Message</label>
              <textarea
                style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                placeholder="Décrivez votre établissement..."
                value={form.message}
                onChange={handleChange("message")}
              />
            </div>

            <button style={{
              background: sending ? "#1e40af" : "#3b82f6", color: "#fff", border: "none",
              borderRadius: 8, padding: "14px 0", fontSize: 16, fontWeight: 600,
              cursor: sending ? "not-allowed" : "pointer", width: "100%", transition: "background .2s",
              opacity: sending ? 0.7 : 1,
            }}
              onMouseEnter={(e) => !sending && (e.currentTarget.style.background = "#2563eb")}
              onMouseLeave={(e) => !sending && (e.currentTarget.style.background = "#3b82f6")}
              onClick={handleSubmit}
              disabled={sending}
            >
              {sending ? "Envoi en cours..." : "Envoyer la demande"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      background: "#0a0d14", borderTop: "1px solid #1f2937",
      padding: "28px 80px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <svg width="22" height="22" viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
        </svg>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>EduNexus Education</span>
      </a>
      <span style={{ color: "#4a5568", fontSize: 13 }}>
        © 2026 EduNexus Education — Plateforme de gestion scolaire intelligente — Cameroun
      </span>
    </footer>
  );
}

const Home = () => {
  return (
    <div style={{ background: "#0a0d14", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }
        a { text-decoration: none; }
      `}</style>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Home;