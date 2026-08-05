from __future__ import annotations

import torch
from torch import nn
from torchvision import models


class FundusQualityNet(nn.Module):
    """3-class quality model: good / usable / reject."""

    def __init__(self, num_classes: int = 3):
        super().__init__()
        backbone = models.efficientnet_b0(weights=None)
        in_features = backbone.classifier[1].in_features
        backbone.classifier[1] = nn.Linear(in_features, num_classes)
        self.backbone = backbone

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)
