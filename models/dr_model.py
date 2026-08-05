from __future__ import annotations

import torch
from torch import nn
from efficientnet_pytorch import EfficientNet


class DRGradingNet(nn.Module):
    """Diabetic retinopathy regression model."""

    def __init__(self):
        super().__init__()

        self.backbone = EfficientNet.from_name("efficientnet-b3")
        in_features = self.backbone._fc.in_features
        self.backbone._fc = nn.Linear(in_features, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)
