import React from "react";

const SearchBar: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 9,
      padding: "11px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "24px 0 24px 0",
      boxShadow: "0 2px 8px #0001",
      maxWidth: 340,
    }}
  >
    <svg width="18" height="18" fill="none" style={{ color: "#9ca3af" }}>
      <path d="M12.5 12.5L17 17" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="8" r="6" stroke="#9ca3af" strokeWidth="2" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Rechercher par école, email, administrateur..."
      style={{
        background: "transparent",
        border: "none",
        outline: "none",
        color: "#111827",
        fontSize: 15,
        flex: 1,
        fontFamily: "'DM Sans', Arial, sans-serif",
        padding: 0,
        marginLeft: 2,
      }}
    />
  </div>
);

export default SearchBar;
