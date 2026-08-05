from __future__ import annotations

import io
from PIL import Image, UnidentifiedImageError
import numpy as np


def load_pil_image(image_bytes: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(image_bytes)).convert('RGB')
    except UnidentifiedImageError as exc:
        raise ValueError('Unable to read the uploaded image.') from exc


def pil_to_numpy(image: Image.Image) -> np.ndarray:
    return np.array(image)
