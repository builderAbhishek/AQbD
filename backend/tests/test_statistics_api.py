import pytest

def test_statistics(client, db_session):
    res = client.post("/api/v1/projects/", json={"project_code": "TEST-3", "project_name": "Test Stat"})
    project_id = res.json()["id"]
    
    # Factors
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "A", "name": "pH", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 4.0, "high_value": 6.0, "levels": 2
    })
    client.post(f"/api/v1/projects/{project_id}/factors/", json={
        "code": "B", "name": "Flow", "type": "CONTINUOUS", "role": "CRITICAL", 
        "low_value": 0.8, "high_value": 1.2, "levels": 2
    })
    
    # Response
    res = client.post(f"/api/v1/projects/{project_id}/responses/", json={
        "code": "R1", "name": "Resolution", "target_type": "MAXIMIZE", "importance": 5
    })
    resp_id = res.json()["id"]
    
    # Generate DOE
    res = client.post(f"/api/v1/projects/{project_id}/doe/", json={
        "design_type": "FULL_FACTORIAL",
        "center_points": 0
    })
    design_id = res.json()["id"]
    
    # Enter mock data for 4 runs
    runs = client.get(f"/api/v1/doe/{design_id}/runs/").json()
    mock_responses = [2.0, 2.5, 3.0, 3.5] # Perfectly linear
    for i, run in enumerate(runs):
        client.put(f"/api/v1/experiments/{run['id']}", json={
            "response_values": {"Resolution": mock_responses[i]}
        })
        
    # Run analysis
    res = client.post(f"/api/v1/projects/{project_id}/analysis/", json={
        "design_id": design_id,
        "response_id": resp_id,
        "model_type": "FIRST_ORDER"
    })
    
    assert res.status_code == 200
    data = res.json()
    assert data["model_type"] == "FIRST_ORDER"
    assert len(data["coefficients"]) == 3 # Intercept + A + B
    assert isinstance(data["metrics"]["r_squared"], float)
