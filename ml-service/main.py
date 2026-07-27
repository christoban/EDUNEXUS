"""
ZekoulABia — Microservice de prédiction (Infrastructure prédictive, Partie B du plan)

Ce service expose TabPFN v2 (Prior Labs License — Apache 2.0 + attribution obligatoire) en
apprentissage-en-contexte : il ne "connaît" rien a priori, il reçoit à chaque requête un
contexte d'exemples déjà étiquetés (context_features/context_labels) et prédit à partir de ce
contexte pour les nouvelles observations (query_features). Sans contexte suffisant, il répond
honnêtement "insufficient_context" plutôt que d'inventer une prédiction — conforme au principe
non négociable du plan (B.5) : ce jeu de données réel n'existe pas encore à l'échelle nécessaire
chez ZekoulABia, donc ce service reste isolé de toute décision réelle tant que ce n'est pas le cas.

Version du modèle EXPLICITEMENT figée sur V2 — jamais la version par défaut du paquet `tabpfn`
(qui installe aujourd'hui TabPFN-3, sous licence non-commerciale). Voir LICENSE_NOTICE.md.

Ce service ne touche JAMAIS de base de données — entièrement sans état, aucun accès disque
persistant, aucune écriture nulle part.
"""
from typing import List, Optional

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field
from tabpfn import TabPFNClassifier
from tabpfn.constants import ModelVersion

MODEL_VERSION = ModelVersion.V2
MIN_CONTEXT_SIZE = 10  # en dessous, l'apprentissage en contexte n'est pas jugé assez fiable

app = FastAPI(
    title="ZekoulABia ML Service",
    description="Built with PriorLabs-TabPFN — https://github.com/PriorLabs/TabPFN",
    version="0.1.0",
)


class PredictionRequest(BaseModel):
    context_features: Optional[List[List[float]]] = Field(
        default=None, description="Vecteurs de features des exemples déjà étiquetés (X_train)"
    )
    context_labels: Optional[List[str]] = Field(
        default=None, description="Labels connus correspondants (y_train) — classes en chaîne"
    )
    query_features: List[List[float]] = Field(
        description="Vecteurs de features des observations à prédire (X_test)"
    )


class PredictionResponse(BaseModel):
    insufficient_context: bool
    context_size: int
    model_version: str
    # class_probabilities[i] = { "CLASSE_A": 0.2, "CLASSE_B": 0.8, ... } pour query_features[i]
    class_probabilities: Optional[List[dict]] = None


def _predire(req: PredictionRequest) -> PredictionResponse:
    context_size = len(req.context_labels) if req.context_labels else 0

    if context_size < MIN_CONTEXT_SIZE or not req.context_features:
        return PredictionResponse(
            insufficient_context=True,
            context_size=context_size,
            model_version=str(MODEL_VERSION),
            class_probabilities=None,
        )

    model = TabPFNClassifier.create_default_for_version(MODEL_VERSION)
    x_train = np.array(req.context_features)
    y_train = np.array(req.context_labels)
    x_test = np.array(req.query_features)

    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)
    classes = model.classes_

    class_probabilities = [
        {str(cls): float(proba) for cls, proba in zip(classes, row)}
        for row in probabilities
    ]

    return PredictionResponse(
        insufficient_context=False,
        context_size=context_size,
        model_version=str(MODEL_VERSION),
        class_probabilities=class_probabilities,
    )


@app.get("/health")
def health():
    return {"status": "ok", "model_version": str(MODEL_VERSION), "attribution": "Built with PriorLabs-TabPFN"}


@app.post("/predict/risque-eleve", response_model=PredictionResponse)
def predict_risque_eleve(req: PredictionRequest):
    return _predire(req)


@app.post("/predict/risque-impaye", response_model=PredictionResponse)
def predict_risque_impaye(req: PredictionRequest):
    return _predire(req)


@app.post("/predict/orientation", response_model=PredictionResponse)
def predict_orientation(req: PredictionRequest):
    # Secondaire tant que la Partie A avance avec son propre moteur de règles (voir plan B.6.3) —
    # exposé ici pour la cohérence de l'interface, pas pour piloter une vraie recommandation.
    return _predire(req)
