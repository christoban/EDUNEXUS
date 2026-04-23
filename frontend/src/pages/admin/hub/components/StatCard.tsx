import React from "react";

interface StatCardProps {
  label: string;
  value: number;
  selected?: boolean;
  color: "pending" | "rejected" | "approved" | "active";
  onClick?: () => void;
}

const cardStyles = {
  pending: {
    background: "#160f04",
    border: "2px solid #92400e",
    selectedBorder: "2px solid #f97316",
    glow: "0 0 0 1px #f97316, 0 4px 20px rgba(249,115,22,.15)",
    label: "#fb923c",
  },
  rejected: {
    background: "#160404",
    border: "2px solid #991b1b",
    selectedBorder: "2px solid #ef4444",
    glow: "0 0 0 1px #ef4444, 0 4px 20px rgba(239,68,68,.15)",
    label: "#f87171",
  },
  approved: {
    background: "#04091a",
    border: "2px solid #1e3a6e",
    selectedBorder: "2px solid #3b82f6",
    glow: "0 0 0 1px #3b82f6, 0 4px 20px rgba(59,130,246,.15)",
    label: "#60a5fa",
  },
  active: {
    background: "#041208",
    border: "2px solid #166534",
    selectedBorder: "2px solid #22c55e",
    glow: "0 0 0 1px #22c55e, 0 4px 20px rgba(34,197,94,.15)",
    label: "#4ade80",
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, selected, color, onClick }) => {
  const style = cardStyles[color];
  return (
    <div
      onClick={onClick}
      style={{
        background: style.background,
        border: selected ? style.selectedBorder : style.border,
        borderRadius: 12,
        padding: "20px 22px",
        boxShadow: selected ? style.glow : undefined,
        cursor: "pointer",
        userSelect: "none",
        transition: "box-shadow .18s, border .18s",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: style.label,
          marginBottom: 8,
          fontFamily: "'DM Sans', Arial, sans-serif",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: "#fff",
          marginBottom: 6,
          fontFamily: "'DM Sans', Arial, sans-serif",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "#4b6070",
          fontFamily: "'DM Sans', Arial, sans-serif",
        }}
      >
        {color === "pending"
          ? "En attente de validation"
          : color === "rejected"
          ? "Demandes refusées"
          : color === "approved"
          ? "Approuvées, non actives"
          : "Établissements en ligne"}
      </span>
    </div>
  );
};

export default StatCard;
