from __future__ import annotations

from pydantic import BaseModel
from typing import Any, Optional


class QualityMetrics(BaseModel):
    blur_score: float
    brightness_score: float
    contrast_score: float
    centering_score: float
    width: int
    height: int


class QualityResult(BaseModel):
    quality_label: str
    quality_score: float
    metrics: QualityMetrics
    issues: list[str]
    recommendations: list[str]
    source: str


class PredictionDetails(BaseModel):
    next_steps: str
    screening_only: bool = True
    not_medical_diagnosis: bool = True
    model_note: str


class PredictionResult(BaseModel):
    grade: int
    label: str
    confidence: float
    risk_level: str
    summary: str
    details: PredictionDetails
    features: Optional[dict[str, float]] = None
    source: str
    score: float


class AnalysisResponse(BaseModel):
    success: bool
    can_analyze: bool
    message: str
    quality: QualityResult
    prediction: Optional[PredictionResult]
    debug: Optional[dict[str, Any]] = None
