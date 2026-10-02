import pytest
from factors.models import Factor
from responses.models import ResponseModel
from analysis.models import Analysis

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

    # 3. Create analyses
    a1 = Analysis(
        project_id=project_id,
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

    # 4. Valid calculation with deduplicated response_ids and analysis_ids
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

    # 5. Defensive validation: Duplicate response_ids must be rejected with 400
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

    # 6. Defensive validation: Duplicate analysis_ids must be rejected with 400
    resp_dup_anal = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "analysis_ids": [a1.id, a1.id],
            "grid_resolution": 20
        }
    )
    assert resp_dup_anal.status_code == 400
    assert "Duplicate analysis IDs" in resp_dup_anal.json()["detail"]

    # 7. Defensive validation: Multiple models for the same response must be rejected with 400
    resp_multi_model = client.post(
        f"/api/v1/projects/{project_id}/design-space/",
        json={
            "analysis_ids": [a1.id, a1_quad.id],
            "grid_resolution": 20
        }
    )
    assert resp_multi_model.status_code == 400
    assert "Duplicate response constraint" in resp_multi_model.json()["detail"]
