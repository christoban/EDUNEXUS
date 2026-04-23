import React from 'react';

interface Props {
  auditLog: string[];
}

const AuditLog: React.FC<Props> = ({ auditLog }) => {
  return (
    <div className="audit-log">
      <h2>Journal d’audit</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {auditLog.length === 0 && <li style={{ color: '#b2bec3' }}>Aucune action récente</li>}
        {auditLog.map((entry, idx) => (
          <li key={idx}>{entry}</li>
        ))}
      </ul>
    </div>
  );
};

export default AuditLog;
