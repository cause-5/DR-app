from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_DIR = BASE_DIR / 'weights'
DATA_DIR = BASE_DIR / 'data'


@dataclass
class Settings:
    app_name: str = 'DR Screening Backend'
    version: str = '1.0.0'
    model_mode: str = os.getenv('MODEL_MODE', 'auto')  # auto | demo | real
    quality_weights: Path = Path(os.getenv('QUALITY_WEIGHTS', WEIGHTS_DIR / 'quality_model.pth'))
    dr_weights: Path = Path(os.getenv('DR_WEIGHTS', WEIGHTS_DIR / 'dr_model.pth'))
    allowed_image_types: tuple[str, ...] = ('image/jpeg', 'image/png', 'image/jpg', 'image/webp')
    max_upload_mb: int = int(os.getenv('MAX_UPLOAD_MB', '15'))
    image_size_quality: int = int(os.getenv('IMAGE_SIZE_QUALITY', '224'))
    image_size_dr: int = int(os.getenv('IMAGE_SIZE_DR', '760'))


settings = Settings()
