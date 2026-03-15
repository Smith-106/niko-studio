# -*- coding: utf-8 -*-

import pytest


def test_distill_service_wrapper_emits_deprecation_warning():
    import src.services as services

    with pytest.warns(DeprecationWarning, match="DistillService is deprecated"):
        obj = services.DistillService()

    assert obj.__class__.__name__ == "DistillService"
