import React from "react";

interface AuditLogEntry {
  _id?: string;
  action: string;
  details?: string;
  createdAt: string;
}

interface AuditLogProps {
  logs: AuditLogEntry[];
  loading?: boolean;
}

const AuditLog: React.FC<AuditLogProps> = ({ logs, loading }) => {
  if (loading) {
    return <span style={{ color: "#4b6070", fontSize: 12 }}>Chargement...</span>;
  }

  if (logs.length === 0) {
    return (
      <span style={{ color: "#4b6070", fontSize: 12 }}>
        Aucune activité enregistrée
      </span>
    );
  }

  return (
    <div>
      {logs.map((log, index) => (
        <div
          key={log._id || index}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            paddingBottom: 10,
            borderBottom: index < logs.length - 1 ? "1px solid #0f1825" : "none",
            marginBottom: index < logs.length - 1 ? 10 : 0,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3b82f6",
              boxShadow: "0 0 6px rgba(59,130,246,.4)",
              flexShrink: 0,
              marginTop: 5,
            }}
          />
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>
              {log.action}
            </span>
            {log.details && (
              <div style={{ fontSize: 11, color: "#4b6070", marginTop: 2 }}>
                {log.details}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#2d3f55", marginTop: 2 }}>
              {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AuditLog;