import pytest

def test_generate_doe(client, db_session):
    # Create project
    res = client.post("/api/v1/projects/", json={"project_code": "TEST-1", "project_name": "Test DOE"})
    project_id = res.json()["id"]
    
    # Create factors
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "A", "name": "pH", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 4.0, "high_value": 6.0, "levels": 2
    })
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "B", "name": "Flow", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 0.8, "high_value": 1.2, "levels": 2
    })
    
    # Generate DOE
    res = client.post(f"/api/v1/projects/{project_id}/doe/", json={
        "design_type": "FULL_FACTORIAL",
        "center_points": 3
    })
    
    assert res.status_code == 201
    data = res.json()
    assert data["design_type"] == "FULL_FACTORIAL"
    assert data["center_point_count"] == 3
    assert len(data["coded_matrix"]) == 7 # 2^2 = 4 base + 3 centers = 7

def test_experiments(client, db_session):
    # Assume project 1 has DOE 1
    res = client.post("/api/v1/projects/", json={"project_code": "TEST-2", "project_name": "Test Exp"})
    project_id = res.json()["id"]
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "A", "name": "pH", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 4.0, "high_value": 6.0, "levels": 2
    })
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "B", "name": "Flow", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 0.8, "high_value": 1.2, "levels": 2
    })
    res = client.post(f"/api/v1/projects/{project_id}/doe/", json={
        "design_type": "FULL_FACTORIAL",
        "center_points": 0
    })
    design_id = res.json()["id"]
    
    res = client.get(f"/api/v1/doe/{design_id}/runs/")
    assert res.status_code == 200
    runs = res.json()
    assert len(runs) == 4
    
    run_id = runs[0]["id"]
    res = client.put(f"/api/v1/experiments/{run_id}", json={
        "response_values": {"Resolution": 2.5}
    })
    assert res.status_code == 200
    assert res.json()["response_values"]["Resolution"] == 2.5
