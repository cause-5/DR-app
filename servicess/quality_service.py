from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from core.config import settings
from models.quality_model import FundusQualityNet
from services.image_io import load_pil_image, pil_to_numpy

QUALITY_LABELS = ['good', 'usable', 'reject']


@dataclass
class LoadedQualityModel:
    model: FundusQualityNet
    source: str


class QualityAssessor:
    def __init__(self, weights_path: Path | None = None):
        self.weights_path = weights_path or settings.quality_weights
        self.device = 'cpu'
        self.model_bundle = self._load_real_model_if_available()
        self.transform = transforms.Compose(
            [
                transforms.Resize((settings.image_size_quality, settings.image_size_quality)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    def _load_real_model_if_available(self) -> LoadedQualityModel | None:
        if settings.model_mode == 'demo':
            return None
        if settings.model_mode == 'real' and not self.weights_path.exists():
            raise FileNotFoundError(f'Quality model weights not found: {self.weights_path}')
        if not self.weights_path.exists():
            return None
        model = FundusQualityNet(num_classes=3)
        state = torch.load(self.weights_path, map_location='cpu')
        if isinstance(state, dict) and 'state_dict' in state:
            state = state['state_dict']
        clean_state = {k.replace('module.', ''): v for k, v in state.items()}
        model.load_state_dict(clean_state, strict=False)
        model.eval()
        return LoadedQualityModel(model=model, source=f'real:{self.weights_path.name}')

    @staticmethod
    def _blur_score(gray: np.ndarray) -> float:
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    @staticmethod
    def _brightness_score(gray: np.ndarray) -> float:
        return float(gray.mean())

    @staticmethod
    def _contrast_score(gray: np.ndarray) -> float:
        return float(gray.std())

    @staticmethod
    def _fundus_centering_score(rgb: np.ndarray) -> float:
        h, w, _ = rgb.shape
        center = rgb[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
        border = np.concatenate(
            [
                rgb[: h // 8, :, :].reshape(-1, 3),
                rgb[-h // 8:, :, :].reshape(-1, 3),
                rgb[:, : w // 8, :].reshape(-1, 3),
                rgb[:, -w // 8:, :].reshape(-1, 3),
            ],
            axis=0,
        )
        center_signal = float(center.mean())
        border_signal = float(border.mean())
        diff = abs(center_signal - border_signal)
        return max(0.0, min(100.0, 100.0 - diff))

    def _heuristic_quality(self, image: Image.Image) -> dict[str, Any]:
        rgb = pil_to_numpy(image)
        h, w, _ = rgb.shape
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        blur = self._blur_score(gray)
        brightness = self._brightness_score(gray)
        contrast = self._contrast_score(gray)
        centering = self._fundus_centering_score(rgb)

        issues: list[str] = []
        quality_score = 100.0

        if min(h, w) < 400:
            quality_score -= 20
            issues.append('image resolution is low')
        if blur < 40:
            quality_score -= 35
            issues.append('image appears blurry')
        elif blur < 80:
            quality_score -= 15
            issues.append('image is slightly soft')
        if brightness < 50:
            quality_score -= 20
            issues.append('image is too dark')
        elif brightness > 210:
            quality_score -= 15
            issues.append('image is overexposed')
        if contrast < 25:
            quality_score -= 15
            issues.append('image contrast is weak')
        if centering < 45:
            quality_score -= 15
            issues.append('retina may not be centered properly')

        quality_score = max(0.0, min(100.0, quality_score))
        if quality_score >= 75:
            label = 'good'
        elif quality_score >= 50:
            label = 'usable'
        else:
            label = 'reject'

        return {
            'quality_label': label,
            'quality_score': round(quality_score, 2),
            'metrics': {
                'blur_score': round(blur, 2),
                'brightness_score': round(brightness, 2),
                'contrast_score': round(contrast, 2),
                'centering_score': round(centering, 2),
                'width': w,
                'height': h,
            },
            'issues': issues,
            'recommendations': [] if label == 'good' else [
                'Keep the camera steady and avoid motion blur.',
                'Retake in better lighting.',
                'Ensure the retinal region is centered and fully visible.',
            ],
            'source': 'heuristic',
        }

    def _real_quality(self, image: Image.Image) -> dict[str, Any]:
        # Still include heuristics for readable debug/UX metrics.
        heuristic = self._heuristic_quality(image)
        assert self.model_bundle is not None
        tensor = self.transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = self.model_bundle.model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze(0).tolist()
        pred_idx = int(np.argmax(probs))
        label = QUALITY_LABELS[pred_idx]
        confidence = max(probs)
        # Blend real class confidence with heuristic score to keep UX meaningful.
        score_map = {'good': 90, 'usable': 65, 'reject': 35}
        heuristic['quality_label'] = label
        heuristic['quality_score'] = round((score_map[label] * 0.7) + (heuristic['quality_score'] * 0.3), 2)
        heuristic['source'] = self.model_bundle.source
        heuristic.setdefault('model_probs', {QUALITY_LABELS[i]: round(float(p), 4) for i, p in enumerate(probs)})
        heuristic.setdefault('recommendations', [])
        if confidence < 0.55 and label != 'good':
            heuristic['recommendations'].append('Model confidence is modest; consider retaking the image.')
        return heuristic

    def assess(self, image_bytes: bytes) -> dict[str, Any]:
        image = load_pil_image(image_bytes)
        if self.model_bundle is not None:
            return self._real_quality(image)
        return self._heuristic_quality(image)
