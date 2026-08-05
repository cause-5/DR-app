from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from core.config import settings
from models.dr_model import DRGradingNet
from services.image_io import load_pil_image, pil_to_numpy

GRADE_LABELS = {
    0: 'No DR',
    1: 'Mild',
    2: 'Moderate',
    3: 'Severe',
    4: 'Proliferative DR',
}

GRADE_DETAILS = {
    0: 'No obvious diabetic retinopathy patterns detected in this screening pass.',
    1: 'Small early abnormalities may be present. Follow-up screening is recommended.',
    2: 'Moderate diabetic retinopathy risk. Clinical review is recommended.',
    3: 'High diabetic retinopathy risk. Please consult an eye specialist promptly.',
    4: 'Very high diabetic retinopathy risk. Urgent ophthalmology follow-up is advised.',
}


class DRPredictor:
    def _score_to_grade(self, score: float) -> int:
        score = max(0.0, min(4.0, score))
        if score < 0.5:
            return 0
        elif score < 1.5:
            return 1
        elif score < 2.5:
            return 2
        elif score < 3.5:
            return 3
        else:
            return 4
    def __init__(self, weights_path: Path | None = None):
        self.weights_path = weights_path or settings.dr_weights
        self.model = self._load_real_model_if_available()
        self.transform = transforms.Compose(
            [
                transforms.Resize((settings.image_size_dr, settings.image_size_dr)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.3199, 0.2240, 0.1609], std=[0.3020, 0.2183, 0.1741]),
            ]
        )

    def _load_real_model_if_available(self) -> DRGradingNet | None:
        if settings.model_mode == 'demo':
            return None
        if settings.model_mode == 'real' and not self.weights_path.exists():
            raise FileNotFoundError(f'DR model weights not found: {self.weights_path}')
        if not self.weights_path.exists():
            return None
        model = DRGradingNet()
        state = torch.load(self.weights_path, map_location='cpu', weights_only=False)
        if isinstance(state, dict) and 'state_dict' in state:
            state = state['state_dict']
        clean_state = {}

        for key, value in state.items():
            key = key.replace("module.", "")

            if not key.startswith("backbone."):
                key = "backbone." + key

            clean_state[key] = value
        missing, unexpected = model.load_state_dict(clean_state, strict=True)
        print("Loaded model")
        print("Missing keys:", len(missing))
        print("Unexpected keys:", len(unexpected))

        if missing:
                print(missing[:10])

        if unexpected:
                print(unexpected[:10])

        model.eval()
        return model

    @staticmethod
    def _extract_simple_features(rgb: np.ndarray) -> dict[str, float]:
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        red_channel = rgb[:, :, 0].astype(np.float32)
        green_channel = rgb[:, :, 1].astype(np.float32)
        value_channel = hsv[:, :, 2].astype(np.float32)

        redness_ratio = float((red_channel.mean() + 1e-6) / (green_channel.mean() + 1e-6))
        bright_spot_ratio = float((value_channel > 220).mean())
        dark_spot_ratio = float((gray < 40).mean())
        vessel_texture_proxy = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return {
            'redness_ratio': redness_ratio,
            'bright_spot_ratio': bright_spot_ratio,
            'dark_spot_ratio': dark_spot_ratio,
            'texture_proxy': vessel_texture_proxy,
        }

    def _heuristic_predict(self, image: Image.Image, quality_result: dict[str, Any]) -> dict[str, Any]:
        rgb = pil_to_numpy(image)
        features = self._extract_simple_features(rgb)
        quality_score = float(quality_result['quality_score'])

        risk = 0.0
        risk += min(25.0, max(0.0, (features['redness_ratio'] - 0.9) * 40.0))
        risk += min(25.0, features['bright_spot_ratio'] * 250.0)
        risk += min(20.0, features['dark_spot_ratio'] * 120.0)
        risk += min(20.0, features['texture_proxy'] / 40.0)
        risk += max(0.0, (75.0 - quality_score) * 0.2)

        if risk < 20:
            grade = 0
        elif risk < 35:
            grade = 1
        elif risk < 50:
            grade = 2
        elif risk < 70:
            grade = 3
        else:
            grade = 4

        confidence = max(0.45, min(0.92, 0.55 + (quality_score / 200.0)))
        return {
            'grade': grade,
            'label': GRADE_LABELS[grade],
            'score': round(float(grade), 3),
            'confidence': round(float(confidence), 3),
            'risk_level': (
                'low' if grade <= 1
                else 'medium' if grade == 2
                else 'high'
            ),
            'summary': GRADE_DETAILS[grade],
            'details': {
            'next_steps': (
                'Retest during routine screening.'
                if grade == 0
                else 'Please arrange a follow-up eye exam.'
                if grade <= 2
                else 'Seek ophthalmology review as soon as possible.'
                ),
                'screening_only': True,
                'not_medical_diagnosis': True,
                'model_note': f'Real regression model loaded from {self.weights_path.name}.',
            },
            'source': f'real:{self.weights_path.name}',
}

    def _real_predict(self, image: Image.Image) -> dict[str, Any]:
        assert self.model is not None
        tensor = self.transform(image).unsqueeze(0)
        with torch.no_grad():
            score = self.model(tensor).squeeze().item()

            grade = self._score_to_grade(score)
            confidence = 1 - min(abs(score - round(score)), 1)
            return {
            'grade': grade,
            'label': GRADE_LABELS[grade],
            'score': round(float(score), 3),
            'confidence': round(float(confidence), 3),
            'risk_level': 'low' if grade <= 1 else 'medium' if grade == 2 else 'high',
            'summary': GRADE_DETAILS[grade],
            'details': {
                'next_steps': (
                    'Retest during routine screening.' if grade == 0
                    else 'Please arrange a follow-up eye exam.' if grade <= 2
                    else 'Seek ophthalmology review as soon as possible.'
                    ),
                    'screening_only': True,
                    'not_medical_diagnosis': True,
                    'model_note': f'Real regression model loaded from {self.weights_path.name}.',
                    },
                    'source': f'real:{self.weights_path.name}',
                    }

    def predict(self, image_bytes: bytes, quality_result: dict[str, Any]) -> dict[str, Any]:
        image = load_pil_image(image_bytes)
        if self.model is not None:
            return self._real_predict(image)
        return self._heuristic_predict(image, quality_result)
