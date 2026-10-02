import pytest
import numpy as np
from core.prediction import (
    actual_to_coded,
    predict_from_coded,
    predict_from_actual,
    calculate_desirability,
    calculate_overall_desirability,
)
from optimization.service import OptimizationEngine

class DummyFactor:
    def __init__(self, code, low, high, name=None):
        self.code = code
        self.name = name or code
        self.low_value = float(low)
        self.high_value = float(high)

def test_actual_to_coded():
    factors = [
        DummyFactor("A", 60.0, 70.0),
        DummyFactor("B", 0.8, 1.2),
        DummyFactor("C", 25.0, 35.0),
    ]

    # Center points -> all coded 0
    center_vals = {"A": 65.0, "B": 1.0, "C": 30.0}
    coded_center = actual_to_coded(factors, center_vals)
    assert pytest.approx(coded_center["A"], abs=1e-6) == 0.0
    assert pytest.approx(coded_center["B"], abs=1e-6) == 0.0
    assert pytest.approx(coded_center["C"], abs=1e-6) == 0.0

    # Low bounds -> all -1
    low_vals = {"A": 60.0, "B": 0.8, "C": 25.0}
    coded_low = actual_to_coded(factors, low_vals)
    assert pytest.approx(coded_low["A"], abs=1e-6) == -1.0
    assert pytest.approx(coded_low["B"], abs=1e-6) == -1.0
    assert pytest.approx(coded_low["C"], abs=1e-6) == -1.0

    # High bounds -> all +1
    high_vals = {"A": 70.0, "B": 1.2, "C": 35.0}
    coded_high = actual_to_coded(factors, high_vals)
    assert pytest.approx(coded_high["A"], abs=1e-6) == 1.0
    assert pytest.approx(coded_high["B"], abs=1e-6) == 1.0
    assert pytest.approx(coded_high["C"], abs=1e-6) == 1.0

    # Known candidate: A=64.42, B=0.88, C=30.80
    cand_vals = {"A": 64.42, "B": 0.88, "C": 30.80}
    coded_cand = actual_to_coded(factors, cand_vals)
    assert pytest.approx(coded_cand["A"], abs=1e-4) == -0.1160
    assert pytest.approx(coded_cand["B"], abs=1e-4) == -0.6000
    assert pytest.approx(coded_cand["C"], abs=1e-4) == 0.1600

def test_prediction_known_coefficients():
    factors = [
        DummyFactor("A", 60.0, 70.0),
        DummyFactor("B", 0.8, 1.2),
        DummyFactor("C", 25.0, 35.0),
    ]

    # Model for Resolution: Intercept = 14.45, A = 0.50, B = -0.01, C = 0.50
    coefs_y1 = [
        {"term": "Intercept", "coef": 14.45},
        {"term": "A", "coef": 0.50},
        {"term": "B", "coef": -0.01},
        {"term": "C", "coef": 0.50},
    ]

    # Center prediction should be exactly Intercept = 14.45
    center_pred = predict_from_actual(factors, {"A": 65.0, "B": 1.0, "C": 30.0}, coefs_y1)
    assert pytest.approx(center_pred, abs=1e-6) == 14.45

    # Candidate prediction: A=64.42, B=0.88, C=30.80
    # y = 14.45 + 0.50*(-0.116) - 0.01*(-0.600) + 0.50*(0.160) = 14.478
    cand_pred = predict_from_actual(factors, {"A": 64.42, "B": 0.88, "C": 30.80}, coefs_y1)
    assert pytest.approx(cand_pred, abs=1e-3) == 14.478

def test_desirability_outside_acceptance_limits():
    # MAXIMIZE: acceptance >= 2000. If y = 20.596 -> d MUST BE 0.0 (NOT 0.5!)
    d_max_fail = calculate_desirability(
        y=20.596,
        target_type="MAXIMIZE",
        lower_limit=2000.0,
        upper_limit=None,
        importance=3
    )
    assert d_max_fail == 0.0, f"Expected 0.0 for MAXIMIZE below lower_limit, got {d_max_fail}"

    # MINIMIZE: acceptance <= 2.0. If y = 16.477 -> d MUST BE 0.0 (NOT 0.5!)
    d_min_fail = calculate_desirability(
        y=16.477,
        target_type="MINIMIZE",
        lower_limit=None,
        upper_limit=2.0,
        importance=4
    )
    assert d_min_fail == 0.0, f"Expected 0.0 for MINIMIZE above upper_limit, got {d_min_fail}"

    # TARGET: target = 5.0. If y = 18.477 -> d MUST BE 0.0 (NOT 0.5!)
    d_target_fail = calculate_desirability(
        y=18.477,
        target_type="TARGET",
        target=5.0,
        lower_limit=4.0,
        upper_limit=6.0,
        importance=4
    )
    assert d_target_fail == 0.0, f"Expected 0.0 for TARGET outside tolerance, got {d_target_fail}"

    # TARGET with no explicit lower/upper: target = 5.0, y = 18.477 -> d MUST BE 0.0
    d_target_no_tol = calculate_desirability(
        y=18.477,
        target_type="TARGET",
        target=5.0,
        importance=4
    )
    assert d_target_no_tol == 0.0, f"Expected 0.0 for TARGET far from target, got {d_target_no_tol}"

def test_desirability_within_acceptance():
    # MAXIMIZE: acceptance >= 2.0. If y = 14.477, data_max = 15.26 -> d > 0
    d_max_pass = calculate_desirability(
        y=14.477,
        target_type="MAXIMIZE",
        lower_limit=2.0,
        upper_limit=15.26,
        importance=5
    )
    assert d_max_pass > 0.8, f"Expected high desirability for 14.477 in [2.0, 15.26], got {d_max_pass}"

    # TARGET: at target = 5.0 -> d MUST BE 1.0
    d_target_exact = calculate_desirability(
        y=5.0,
        target_type="TARGET",
        target=5.0,
        lower_limit=4.0,
        upper_limit=6.0,
        importance=4
    )
    assert pytest.approx(d_target_exact, abs=1e-6) == 1.0

def test_overall_desirability_fails_if_any_response_fails():
    desirabilities = {
        "Y1": 0.90,  # passes
        "Y2": 0.0,   # FAILS
        "Y3": 0.0,   # FAILS
        "Y4": 0.0,   # FAILS
    }
    importances = {"Y1": 5.0, "Y2": 4.0, "Y3": 4.0, "Y4": 3.0}

    D = calculate_overall_desirability(desirabilities, importances)
    assert D == 0.0, f"Overall desirability must be 0 when any response has d=0, got {D}"

def test_overall_desirability_all_pass():
    desirabilities = {
        "Y1": 0.90,
        "Y2": 0.80,
        "Y3": 0.85,
        "Y4": 0.95,
    }
    importances = {"Y1": 5.0, "Y2": 4.0, "Y3": 4.0, "Y4": 3.0}
    total_w = 16.0

    expected_D = (
        (0.90 ** 5.0) *
        (0.80 ** 4.0) *
        (0.85 ** 4.0) *
        (0.95 ** 3.0)
    ) ** (1.0 / total_w)

    D = calculate_overall_desirability(desirabilities, importances)
    assert pytest.approx(D, abs=1e-4) == expected_D

def test_optimizer_bounds_and_prediction_traceability():
    factors = [
        DummyFactor("A", 60.0, 70.0, "Mobile Phase"),
        DummyFactor("B", 0.8, 1.2, "Flow Rate"),
        DummyFactor("C", 25.0, 35.0, "Temperature"),
    ]

    models_data = [
        {
            "response_code": "Y1",
            "coefs": [
                {"term": "Intercept", "coef": 14.45},
                {"term": "A", "coef": 0.50},
                {"term": "B", "coef": -0.01},
                {"term": "C", "coef": 0.50},
            ],
            "model_type": "FIRST_ORDER",
            "transformation": "NONE",
            "target_type": "MAXIMIZE",
            "lower_limit": 2.0,
            "upper_limit": 16.0,
            "target": None,
            "importance": 5.0,
        },
        {
            "response_code": "Y2",
            "coefs": [
                {"term": "Intercept", "coef": 16.45},
                {"term": "A", "coef": 0.50},
                {"term": "B", "coef": -0.01},
                {"term": "C", "coef": 0.50},
            ],
            "model_type": "FIRST_ORDER",
            "transformation": "NONE",
            "target_type": "MINIMIZE",
            "lower_limit": 15.0,
            "upper_limit": 18.0,
            "target": None,
            "importance": 4.0,
        },
    ]

    candidates = OptimizationEngine.optimize(factors, models_data)
    assert len(candidates) >= 1
    cand = candidates[0]

    # Verify no extrapolation: factor values are within [low, high]
    for f in factors:
        val = cand["factors"][f.code]
        assert f.low_value <= val <= f.high_value, f"Factor {f.code} value {val} out of bounds [{f.low_value}, {f.high_value}]"

    # Verify candidate response predictions match direct predict_from_actual
    for md in models_data:
        code = md["response_code"]
        direct_pred = predict_from_actual(factors, cand["factors"], md["coefs"], md["transformation"])
        assert pytest.approx(cand["responses"][code], abs=1e-5) == direct_pred

    # Verify candidate individual desirabilities match calculate_desirability
    for md in models_data:
        code = md["response_code"]
        direct_d = calculate_desirability(
            y=cand["responses"][code],
            target_type=md["target_type"],
            lower_limit=md["lower_limit"],
            upper_limit=md["upper_limit"],
            target=md["target"],
            importance=md["importance"],
        )
        assert pytest.approx(cand["desirabilities"][code], abs=1e-5) == direct_d

    # Verify overall desirability matches
    importances = {md["response_code"]: md["importance"] for md in models_data}
    direct_D = calculate_overall_desirability(cand["desirabilities"], importances)
    assert pytest.approx(cand["overall_desirability"], abs=1e-5) == direct_D
