import pytest

def test_create_project(client):
    response = client.post(
        "/api/v1/projects/",
        json={"project_code": "PROJ-1", "project_name": "New Project"}
    )
    assert response.status_code == 201
    assert response.json()["project_code"] == "PROJ-1"

def test_create_atp(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/atp/",
        json={
            "name": "Resolution",
            "target_type": "MINIMUM",
            "lower_limit": 2.0
        }
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Resolution"

def test_invalid_atp_target_type(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/atp/",
        json={
            "name": "Resolution",
            "target_type": "INVALID_TYPE",
            "lower_limit": 2.0
        }
    )
    assert response.status_code == 422 # Pydantic validation error

def test_invalid_atp_range(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/atp/",
        json={
            "name": "Resolution",
            "target_type": "RANGE",
            "lower_limit": 5.0,
            "upper_limit": 2.0 # Invalid: upper < lower
        }
    )
    assert response.status_code == 422

def test_create_risk_assessment_rpn_calculation(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/risk/",
        json={
            "parameter": "pH",
            "severity": 4,
            "occurrence": 3,
            "detectability": 2,
            "priority": "Medium"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["risk_score"] == 24 # 4 * 3 * 2

def test_invalid_risk_value(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/risk/",
        json={
            "parameter": "pH",
            "severity": 11, # Invalid: > 10
            "occurrence": 3,
            "detectability": 2,
            "priority": "Medium"
        }
    )
    assert response.status_code == 422

def test_create_factor(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/factors/",
        json={
            "name": "Flow Rate",
            "code": "F1",
            "type": "CONTINUOUS",
            "low_value": 0.5,
            "high_value": 1.5,
            "role": "CRITICAL"
        }
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Flow Rate"

def test_invalid_factor_range(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/factors/",
        json={
            "name": "Flow Rate",
            "code": "F1",
            "type": "CONTINUOUS",
            "low_value": 1.5,
            "high_value": 0.5, # Invalid: high < low
            "role": "CRITICAL"
        }
    )
    assert response.status_code == 422

def test_create_response(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/responses/",
        json={
            "name": "Tailing Factor",
            "code": "R1",
            "target_type": "MINIMIZE",
            "importance": 5
        }
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Tailing Factor"

def test_invalid_response_goal(client, test_project):
    project_id = test_project["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/responses/",
        json={
            "name": "Tailing Factor",
            "code": "R1",
            "target_type": "INVALID_GOAL",
            "importance": 5
        }
    )
    assert response.status_code == 422
