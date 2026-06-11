-- Drop old column-per-series BacCoefficient table
DROP TABLE IF EXISTS "BacCoefficient";

-- Create new row-per-(subject, serie, niveau) BacCoefficient table
CREATE TABLE "BacCoefficient" (
    id TEXT NOT NULL,
    subjectName TEXT NOT NULL,
    serie TEXT NOT NULL,
    niveau TEXT NOT NULL DEFAULT 'TERMINALE',
    coefficient REAL NOT NULL,
    groupe INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
    isOfficialMinesec BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (id)
);

-- Compound unique: one coefficient per subject + serie + niveau
CREATE UNIQUE INDEX "BacCoefficient_subjectName_serie_niveau_key" ON "BacCoefficient"("subjectName", "serie", "niveau");
