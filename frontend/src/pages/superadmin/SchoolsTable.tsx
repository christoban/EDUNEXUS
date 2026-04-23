import React from 'react';


interface School {
  id: number;
  name: string;
  type: string;
  email: string;
  status: string;
}

interface Props {
  schools: School[];
  onAction?: (id: number, action: 'approve' | 'reject' | 'suspend' | 'delete') => void;
}

const statusColors: Record<string, string> = {
  Pending: "#f7b731",
  Approved: "#45aaf2",
  Active: "#20bf6b",
  Rejected: "#eb3b5a",
};



const SchoolsTable: React.FC<Props> = ({ schools, onAction }) => {
  return (
    <div className="schools-table-container">
      <h2>Établissements</h2>
      <table className="schools-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Type</th>
            <th>Email</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => (
            <tr key={school.id}>
              <td>{school.name || <span style={{ color: '#b2bec3' }}>—</span>}</td>
              <td>{school.type || <span style={{ color: '#b2bec3' }}>—</span>}</td>
              <td>{school.email}</td>
              <td>
                <span
                  className="status-badge"
                  style={{ background: statusColors[school.status] || '#ccc' }}
                >
                  {school.status}
                </span>
              </td>
              <td>
                <button className="action-btn approve" onClick={() => onAction && onAction(school.id, 'approve')}>Valider</button>
                <button className="action-btn reject" onClick={() => onAction && onAction(school.id, 'reject')}>Rejeter</button>
                <button className="action-btn suspend" onClick={() => onAction && onAction(school.id, 'suspend')}>Suspendre</button>
                <button className="action-btn delete" onClick={() => onAction && onAction(school.id, 'delete')}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SchoolsTable;
