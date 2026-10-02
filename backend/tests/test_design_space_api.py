import pytest
from factors.models import Factor
from responses.models import ResponseModel
from doe.models import DOEDesign
from analysis.models import Analysis
from optimization.models import OptimizationRun
from design_space.service import DesignSpaceEngine

def test_design_space_success_and_deduplication(client, test_project, db_session):
    project_id = test_project["id"]

    # 1. Create factors
    f1 = Factor(project_id=project_id, name="Flow Rate", code="A", type="CONTINUOUS", low_value=0.8, high_value=1.2, role="CRITICAL")
    f2 = Factor(project_id=project_id, name="Temperature", code="B", type="CONTINUOUS", low_value=25.0, high_value=35.0, role="CRITICAL")
    db_session.add_all([f1, f2])
    db_session.commit()
    db_session.refresh(f1)
    db_session.refresh(f2)

    # 2. Create responses
    r1 = ResponseModel(project_id=project_id, name="Resolution", code="Y1", target_type="MAXIMIZE", lower_limit=2.0, importance=5)
    r2 = ResponseModel(project_id=project_id, name="Tailing Factor", code="Y2", target_type="MINIMIZE", upper_limit=2.0, importance=4)
    db_session.add_all([r1, r2])
    db_session.commit()
    db_session.refresh(r1)
    db_session.refresh(r2)

    # 3. Create DOE design
    doe = DOEDesign(
        project_id=project_id,
        design_type="BBD",
        factor_mapping=[{"id": f1.id, "code": "A"}, {"id": f2.id, "code": "B"}],
        coded_matrix=[[0, 0], [1, 1], [-1, -1]],
        actual_matrix=[[1.0, 30.0], [1.2, 35.0], [0.8, 25.0]],
        randomized_order=[0, 1, 2],
        standard_order=[0, 1, 2],
        center_point_count=1,
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(doe)
    db_session.commit()
    db_session.refresh(doe)

    # 4. Create analyses
    a1 = Analysis(
        project_id=project_id,
        design_id=doe.id,
        response_id=r1.id,
        model_type="FIRST_ORDER",
        transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 2.5}, {"term": "A", "coef": 0.2}, {"term": "B", "coef": 0.1}],
        anova={},
        diagnostics={},
        metrics={"r_squared": 0.95},
        analysis_version=1,
        software_version="1.0.0",
        created_at="2026-10-02T00:00:00"
    )
    a2 = Analysis(
        project_id=project_id,
        design_id=doe.id,
        response_id=r2.id,
        model_type="FIRST_ORDER",
        transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 1.1}, {"term": "A", "coef": -0.05}, {"term": "B", "coef": 0.02}],
        anova={},
        diagnostics={},
        metrics={"r_squared": 0.92},
        analysis_version=1,
        software_version="1.0.0",
        created_at="2026-10-02T00:00:00"
    )
    # Extra analysis for r1 (quadratic model)
    a1_quad = Analysis(
        project_id=project_id,
        design_id=doe.id,
        response_id=r1.id,
        model_type="QUADRATIC",
        transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 2.6}],
        anova={},
        diagnostics={},
        metrics={"r_squared": 0.96},
        analysis_version=2,
        software_version="1.0.0",
        created_at="2026-10-02T00:01:00"
    )
    db_session.add_all([a1, a2, a1_quad])
    db_session.commit()
    db_session.refresh(a1)
    db_session.refresh(a2)
    db_session.refresh(a1_quad)

    # 5. Valid calculation with deduplicated response_ids and analysis_ids
    resp = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "response_ids": [r1.id, r2.id],
            "analysis_ids": [a1.id, a2.id],
            "grid_resolution": 20
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["grid_resolution"] == 20
    assert len(data["space_data"]["plot_data"]) == 400
    assert data["space_data"]["acceptable_points"] > 0
    assert "projected_ranges" in data["space_data"]
    assert "is_entire_range_acceptable" in data["space_data"]

    # 6. Defensive validation: Duplicate response_ids must be rejected with 400
    resp_dup_resp = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "response_ids": [r1.id, r1.id],
            "analysis_ids": [a1.id],
            "grid_resolution": 20
        }
    )
    assert resp_dup_resp.status_code == 400
    assert "Duplicate response IDs" in resp_dup_resp.json()["detail"]

    # 7. Defensive validation: Duplicate analysis_ids must be rejected with 400
    resp_dup_anal = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "analysis_ids": [a1.id, a1.id],
            "grid_resolution": 20
        }
    )
    assert resp_dup_anal.status_code == 400
    assert "Duplicate analysis IDs" in resp_dup_anal.json()["detail"]

    # 8. Defensive validation: Multiple models for the same response must be rejected with 400
    resp_multi_model = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "analysis_ids": [a1.id, a1_quad.id],
            "grid_resolution": 20
        }
    )
    assert resp_multi_model.status_code == 400
    assert "Duplicate response constraint" in resp_multi_model.json()["detail"]


def test_design_space_scientific_correctness_and_membership(client, test_project, db_session):
    project_id = test_project["id"]

    # Factors: Flow (0.8 - 1.2), Temp (25.0 - 35.0)
    f1 = Factor(project_id=project_id, name="Flow Rate", code="A", type="CONTINUOUS", low_value=0.8, high_value=1.2, role="CRITICAL")
    f2 = Factor(project_id=project_id, name="Temperature", code="B", type="CONTINUOUS", low_value=25.0, high_value=35.0, role="CRITICAL")
    db_session.add_all([f1, f2])
    db_session.commit()
    db_session.refresh(f1)
    db_session.refresh(f2)

    # Response with tight constraint creating failures
    # Lower limit = 2.45
    r1 = ResponseModel(project_id=project_id, name="Resolution", code="Y1", target_type="MAXIMIZE", lower_limit=2.45, importance=5)
    db_session.add(r1)
    db_session.commit()
    db_session.refresh(r1)

    doe = DOEDesign(
        project_id=project_id,
        design_type="BBD",
        factor_mapping=[{"id": f1.id, "code": "A"}, {"id": f2.id, "code": "B"}],
        coded_matrix=[[0, 0]],
        actual_matrix=[[1.0, 30.0]],
        randomized_order=[0],
        standard_order=[0],
        center_point_count=1,
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(doe)
    db_session.commit()
    db_session.refresh(doe)

    # Coded model: Intercept 2.40, A = +0.20, B = -0.10
    # Center (coded 0, 0) gives 2.40 < 2.45 (FAILS constraint!)
    # Top-left (coded +1, -1) gives 2.40 + 0.20 + 0.10 = 2.70 >= 2.45 (PASSES!)
    a1 = Analysis(
        project_id=project_id,
        design_id=doe.id,
        response_id=r1.id,
        model_type="FIRST_ORDER",
        transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 2.40}, {"term": "A", "coef": 0.20}, {"term": "B", "coef": -0.10}],
        anova={},
        diagnostics={},
        metrics={"r_squared": 0.95},
        analysis_version=1,
        software_version="1.0.0",
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(a1)
    db_session.commit()
    db_session.refresh(a1)

    # Add optimization run with feasible point: A=1.2 (coded +1), B=25.0 (coded -1)
    opt_run = OptimizationRun(
        project_id=project_id,
        analysis_id=a1.id,
        settings={},
        candidates=[{
            "factors": {"A": 1.20, "B": 25.0},
            "overall_desirability": 0.85
        }],
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(opt_run)
    db_session.commit()
    db_session.refresh(opt_run)

    # Calculate Design Space
    resp = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={"response_ids": [r1.id], "grid_resolution": 20}
    )
    assert resp.status_code == 201
    sd = resp.json()["space_data"]

    # 1. Acceptable and failed points calculation
    acc = sd["acceptable_points"]
    unacc = sd["unacceptable_points"]
    assert acc + unacc == 400
    assert unacc > 0, "Expected failures in grid due to tight constraint"
    assert acc > 0, "Expected some feasible points in grid"

    # 2. No false claim that entire investigated range is PAR when failures exist
    assert sd["is_entire_range_acceptable"] is False
    assert sd["projected_ranges"]["A"]["is_full_investigated_range"] is False
    assert sd["projected_ranges"]["B"]["is_full_investigated_range"] is False

    # 3. Projected factor ranges
    assert sd["projected_ranges"]["A"]["min"] is not None
    assert sd["projected_ranges"]["A"]["max"] is not None
    assert sd["projected_ranges"]["A"]["investigated_min"] == 0.8
    assert sd["projected_ranges"]["A"]["investigated_max"] == 1.2

    # 4. Optimization point membership check
    opt_check = sd["optimization_point_check"]
    assert opt_check is not None
    assert opt_check["is_inside"] is True
    assert opt_check["setpoints"] == {"A": 1.20, "B": 25.0}
    assert opt_check["cqa_results"]["Y1"]["acceptable"] is True

    # 5. Extrapolating point must be rejected by membership check
    models_data = [{
        "response_code": "Y1",
        "coefs": a1.coefficients,
        "model_type": "FIRST_ORDER",
        "transformation": "NONE",
        "target_type": "MAXIMIZE",
        "lower_limit": 2.45
    }]
    extrap_check = DesignSpaceEngine.verify_point_membership(
        factors=[f1, f2],
        models_data=models_data,
        factor_values={"A": 1.5, "B": 30.0} # A=1.5 extrapolates outside [0.8, 1.2]
    )
    assert extrap_check["is_inside"] is False
    assert "extrapolates outside investigated range" in extrap_check["reason"]


def test_design_space_3d_volume_and_slice_distinction(client, test_project, db_session):
    project_id = test_project["id"]

    # 1. Setup 3 continuous factors: A (60-70), B (0.8-1.2), C (25-35)
    fA = Factor(project_id=project_id, name="Mobile Phase", code="A", type="CONTINUOUS", low_value=60.0, high_value=70.0, role="CRITICAL")
    fB = Factor(project_id=project_id, name="Flow Rate", code="B", type="CONTINUOUS", low_value=0.8, high_value=1.2, role="CRITICAL")
    fC = Factor(project_id=project_id, name="Temperature", code="C", type="CONTINUOUS", low_value=25.0, high_value=35.0, role="CRITICAL")
    db_session.add_all([fA, fB, fC])
    db_session.commit()
    db_session.refresh(fA)
    db_session.refresh(fB)
    db_session.refresh(fC)

    # 2. Setup 4 responses
    r1 = ResponseModel(project_id=project_id, name="Resolution", code="Y1", target_type="MAXIMIZE", lower_limit=2.0, importance=5)
    r2 = ResponseModel(project_id=project_id, name="Tailing Factor", code="Y2", target_type="MINIMIZE", upper_limit=2.0, importance=4)
    r3 = ResponseModel(project_id=project_id, name="Retention Time", code="Y3", target_type="TARGET", target=5.0, importance=3)
    r4 = ResponseModel(project_id=project_id, name="Theoretical Plates", code="Y4", target_type="MAXIMIZE", lower_limit=2000.0, importance=4)
    db_session.add_all([r1, r2, r3, r4])
    db_session.commit()
    db_session.refresh(r1)
    db_session.refresh(r2)
    db_session.refresh(r3)
    db_session.refresh(r4)

    # 3. Create DOE
    doe = DOEDesign(
        project_id=project_id,
        design_type="BBD",
        factor_mapping=[{"id": fA.id, "code": "A"}, {"id": fB.id, "code": "B"}, {"id": fC.id, "code": "C"}],
        coded_matrix=[[0, 0, 0]],
        actual_matrix=[[65.0, 1.0, 30.0]],
        randomized_order=[0],
        standard_order=[0],
        center_point_count=1,
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(doe)
    db_session.commit()
    db_session.refresh(doe)

    # 4. Realistic first-order models matching HPLC benchmark
    a1 = Analysis(
        project_id=project_id, design_id=doe.id, response_id=r1.id, model_type="FIRST_ORDER", transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 2.50}, {"term": "A", "coef": 0.30}, {"term": "B", "coef": -0.15}, {"term": "C", "coef": 0.05}],
        anova={}, diagnostics={}, metrics={"r_squared": 0.95}, analysis_version=1, software_version="1.0.0", created_at="2026-10-02T00:00:00"
    )
    a2 = Analysis(
        project_id=project_id, design_id=doe.id, response_id=r2.id, model_type="FIRST_ORDER", transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 1.15}, {"term": "A", "coef": -0.05}, {"term": "B", "coef": 0.08}, {"term": "C", "coef": -0.02}],
        anova={}, diagnostics={}, metrics={"r_squared": 0.92}, analysis_version=1, software_version="1.0.0", created_at="2026-10-02T00:00:00"
    )
    a3 = Analysis(
        project_id=project_id, design_id=doe.id, response_id=r3.id, model_type="FIRST_ORDER", transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 5.20}, {"term": "A", "coef": -0.80}, {"term": "B", "coef": -0.60}, {"term": "C", "coef": -0.30}],
        anova={}, diagnostics={}, metrics={"r_squared": 0.98}, analysis_version=1, software_version="1.0.0", created_at="2026-10-02T00:00:00"
    )
    a4 = Analysis(
        project_id=project_id, design_id=doe.id, response_id=r4.id, model_type="FIRST_ORDER", transformation="NONE",
        coefficients=[{"term": "Intercept", "coef": 2600.0}, {"term": "A", "coef": 150.0}, {"term": "B", "coef": -200.0}, {"term": "C", "coef": 180.0}],
        anova={}, diagnostics={}, metrics={"r_squared": 0.88}, analysis_version=1, software_version="1.0.0", created_at="2026-10-02T00:00:00"
    )
    db_session.add_all([a1, a2, a3, a4])
    db_session.commit()

    # 5. Add optimization run with setpoint A=66.27, B=0.80, C=35.0
    opt_run = OptimizationRun(
        project_id=project_id,
        analysis_id=a1.id,
        settings={},
        candidates=[{
            "factors": {"A": 66.27, "B": 0.80, "C": 35.0},
            "overall_desirability": 0.625
        }],
        created_at="2026-10-02T00:00:00"
    )
    db_session.add(opt_run)
    db_session.commit()

    # 6. Calculate Design Space with 3D grid and 2D slice at C=30.0
    resp = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "response_ids": [r1.id, r2.id, r3.id, r4.id],
            "grid_resolution": 20,
            "grid_resolution_3d": 15,
            "slice_axis_x": "A",
            "slice_axis_y": "B",
            "fixed_factors": {"C": 30.0}
        }
    )
    assert resp.status_code == 201
    sd = resp.json()["space_data"]

    # Verify 3D dimension and counts
    assert sd["dimension"] == 3
    assert sd["total_3d_points"] == 15 * 15 * 15
    assert sd["acceptable_3d_points"] > 0
    assert sd["unacceptable_3d_points"] > 0
    assert sd["is_entire_3d_range_acceptable"] is False

    # Verify projected C range is NOT incorrectly 30-30
    assert sd["projected_ranges_3d"]["C"]["min"] is not None
    assert sd["projected_ranges_3d"]["C"]["max"] is not None
    assert sd["projected_ranges_3d"]["C"]["min"] <= 26.0
    assert sd["projected_ranges_3d"]["C"]["max"] >= 34.0
    assert sd["projected_ranges_3d"]["C"]["min"] != sd["projected_ranges_3d"]["C"]["max"]

    # Verify 2D slice data is explicitly preserved and distinct from 3D
    slice_data = sd["slice_data"]
    assert slice_data is not None
    assert slice_data["total_points"] == 400
    assert slice_data["axis_x"] == "A"
    assert slice_data["axis_y"] == "B"
    assert slice_data["fixed_factors"] == {"C": 30.0}
    assert "2D Slice" in slice_data["slice_label"]
    assert slice_data["acceptable_points"] > 0

    # Verify optimization point check in 3D
    opt_check = sd["optimization_point_check"]
    assert opt_check is not None
    assert opt_check["is_inside"] is True
    assert opt_check["setpoints"] == {"A": 66.27, "B": 0.80, "C": 35.0}
    assert opt_check["is_on_active_slice"] is False

    # 7. Now slice at C=35.0 (where the optimal setpoint lies)
    resp35 = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "response_ids": [r1.id, r2.id, r3.id, r4.id],
            "grid_resolution": 20,
            "grid_resolution_3d": 15,
            "slice_axis_x": "A",
            "slice_axis_y": "B",
            "fixed_factors": {"C": 35.0}
        }
    )
    assert resp35.status_code == 201
    sd35 = resp35.json()["space_data"]
    opt_check35 = sd35["optimization_point_check"]
    assert opt_check35["is_on_active_slice"] is True

