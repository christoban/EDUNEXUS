import React, { useState } from 'react';

const SchoolOnboardingForm: React.FC = () => {
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  // TODO: Handle onboarding logic
  return (
    <form className="school-onboarding-form">
      <h2>Création du compte établissement</h2>
      <label>Nom de l’établissement</label>
      <input
        type="text"
        value={schoolName}
        onChange={e => setSchoolName(e.target.value)}
        required
      />
      <label>Type d’établissement</label>
      <input
        type="text"
        value={schoolType}
        onChange={e => setSchoolType(e.target.value)}
        required
      />
      <label>Mot de passe administrateur</label>
      <input
        type="password"
        value={adminPassword}
        onChange={e => setAdminPassword(e.target.value)}
        required
      />
      <button type="submit">Finaliser l’inscription</button>
    </form>
  );
};

export default SchoolOnboardingForm;
