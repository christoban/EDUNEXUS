#!/bin/bash

# 🚀 Multi-Tenant Testing Commands
# Prêt à copier-coller dans le terminal

# ============================================
# CONFIG DE BASE
# ============================================

HOST="http://localhost:5000"
MASTER_JWT=""  # À remplir après login master
SCHOOL_1_JWT="" # À remplir après login école 1
SCHOOL_1_ID="" # À remplir après création école 1
SCHOOL_2_ID="" # À remplir après création école 2

# ============================================
# ÉTAPE 1: Login Master Admin (MASTER DB)
# ============================================

echo "=== STEP 1: Master Admin Login ==="
MASTER_LOGIN=$(curl -s -X POST "$HOST/api/master/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@platform.com",
    "password": "admin123"
  }')

echo "Response: $MASTER_LOGIN"
# Copie le JWT du response
# MASTER_JWT="eyJ..."

# ============================================
# ÉTAPE 2: Créer École 1 (Francophone)
# ============================================

echo -e "\n=== STEP 2: Create School 1 (Francophone) ==="
SCHOOL_1=$(curl -s -X POST "$HOST/api/master/schools" \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=$MASTER_JWT" \
  -d '{
    "schoolName": "Lycée Saint-Rémi",
    "schoolMotto": "Excellence en Éducation",
    "systemType": "francophone",
    "structure": "simple",
    "dbName": "edunexus_school_1",
    "dbConnectionString": "mongodb://localhost:27017/edunexus_school_1",
    "foundedYear": 1987,
    "location": "Paris"
  }')

echo "Response: $SCHOOL_1"
# Extract school ID: SCHOOL_1_ID=$(echo $SCHOOL_1 | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

# ============================================
# ÉTAPE 3: Créer École 2 (Anglophone)
# ============================================

echo -e "\n=== STEP 3: Create School 2 (Anglophone) ==="
SCHOOL_2=$(curl -s -X POST "$HOST/api/master/schools" \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=$MASTER_JWT" \
  -d '{
    "schoolName": "Shiloh Academy",
    "schoolMotto": "Education Excellence",
    "systemType": "anglophone",
    "structure": "simple",
    "dbName": "edunexus_school_2",
    "dbConnectionString": "mongodb://localhost:27017/edunexus_school_2",
    "foundedYear": 2005,
    "location": "London"
  }')

echo "Response: $SCHOOL_2"

# ============================================
# ÉTAPE 4: Lister toutes les écoles
# ============================================

echo -e "\n=== STEP 4: List All Schools ==="
curl -s -X GET "$HOST/api/master/schools" \
  -H "Cookie: jwt=$MASTER_JWT" | jq .

# ============================================
# ÉTAPE 5: Créer une config pour École 1
# ============================================

echo -e "\n=== STEP 5: Set Config for School 1 ==="
curl -s -X POST "$HOST/api/master/schools/$SCHOOL_1_ID/config" \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=$MASTER_JWT" \
  -d '{
    "gradingSystem": "over_20",
    "passingGrade": 10,
    "termsType": "trimesters_3",
    "termsNames": ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
    "standardSubjects": [
      { "name": "Mathématiques", "code": "MATH", "coefficient": 3 },
      { "name": "Français", "code": "FR", "coefficient": 2 },
      { "name": "Anglais", "code": "EN", "coefficient": 1 }
    ],
    "bulletinFormat": "standard",
    "includeRankings": true
  }' | jq .

# ============================================
# ÉTAPE 6: Créer une config pour École 2
# ============================================

echo -e "\n=== STEP 6: Set Config for School 2 ==="
curl -s -X POST "$HOST/api/master/schools/$SCHOOL_2_ID/config" \
  -H "Content-Type: application/json" \
  -H "Cookie: jwt=$MASTER_JWT" \
  -d '{
    "gradingSystem": "percent",
    "passingGrade": 60,
    "termsType": "terms_3",
    "termsNames": ["Term 1", "Term 2", "Term 3"],
    "standardSubjects": [
      { "name": "Mathematics", "code": "MATH", "coefficient": 3 },
      { "name": "English", "code": "EN", "coefficient": 2 },
      { "name": "Science", "code": "SCI", "coefficient": 2 }
    ],
    "bulletinFormat": "detailed",
    "includeRankings": true
  }' | jq .

# ============================================
# ÉTAPE 7: Récupérer configs
# ============================================

echo -e "\n=== STEP 7: Get Config for School 1 ==="
curl -s -X GET "$HOST/api/master/schools/$SCHOOL_1_ID/config" \
  -H "Cookie: jwt=$MASTER_JWT" | jq .

echo -e "\n=== STEP 7b: Get Config for School 2 ==="
curl -s -X GET "$HOST/api/master/schools/$SCHOOL_2_ID/config" \
  -H "Cookie: jwt=$MASTER_JWT" | jq .

# ============================================
# ÉTAPE 8: LOGIN USER ÉCOLE 1
# ============================================

echo -e "\n=== STEP 8: Login User School 1 ==="
LOGIN_SCHOOL_1=$(curl -s -X POST "$HOST/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@lycee-saint-remi.fr",
    "password": "password123"
  }')

echo "Response: $LOGIN_SCHOOL_1"
# SCHOOL_1_JWT="eyJ..."

# ============================================
# ÉTAPE 9: Tester requête School 1
# ============================================

echo -e "\n=== STEP 9: Get Classes - School 1 ==="
curl -s -X GET "$HOST/api/classes" \
  -H "Cookie: jwt=$SCHOOL_1_JWT" | jq .

# ============================================
# ÉTAPE 10: TEST D'ISOLATION
# ============================================

echo -e "\n=== STEP 10: Isolation Test ==="
echo "Classes from School 1:"
curl -s -X GET "$HOST/api/classes" \
  -H "Cookie: jwt=$SCHOOL_1_JWT" | jq '.classes | length'

echo "Classes from School 2:"
SCHOOL_2_JWT="" # À remplir après login école 2
curl -s -X GET "$HOST/api/classes" \
  -H "Cookie: jwt=$SCHOOL_2_JWT" | jq '.classes | length'

echo "If counts differ → ISOLATION WORKING ✓"

# ============================================
# BONUS: STATS CONNEXIONS
# ============================================

echo -e "\n=== BONUS: Connection Stats ==="
curl -s -X GET "$HOST/api/debug/db-stats" 2>/dev/null | jq . || echo "Endpoint not available"

# ============================================
# AUTRES TESTS UTILES
# ============================================

# Test middleware protectSchool
echo -e "\n=== Test protectSchool Middleware ==="
curl -s -X GET "$HOST/api/test-school-isolation" \
  -H "Cookie: jwt=$SCHOOL_1_JWT" | jq .

# Logout
echo -e "\n=== Logout ==="
curl -s -X POST "$HOST/api/users/logout" \
  -H "Cookie: jwt=$SCHOOL_1_JWT" | jq .

# ============================================
# NOTES
# ============================================

# 1. Remplacer localhost:27017 par ta vraie MongoDB URL
# 2. Créer les collections dans chaque base avant les tests
# 3. Copier les IDs des responses pour les requests suivantes
# 4. Vérifier que schools sont créées en MASTER DB
# 5. Valider l'isolation: 2 users → 2 bases différentes

# ============================================
# EXPECTED OUTPUTS
# ============================================

# ✓ POST /api/master/schools → { "_id": "...", "schoolName": "..." }
# ✓ GET /api/master/schools → [ { school1 }, { school2 } ]
# ✓ POST /api/master/schools/{id}/config → { "gradingSystem": "..." }
# ✓ GET /api/classes (school 1) → [ classes de école 1 ]
# ✓ GET /api/classes (school 2) → [ classes de école 2 ]
# ✓ Isolation: aucun croisement de données

echo -e "\n=== ✓ Testing complete ==="
