import httpx
import time
import json

BASE_URL = "http://localhost:8000/api/v1"

def run_demo_creation():
    print("Waiting for server to start...")
    # wait a bit for server
    time.sleep(2)

    with httpx.Client(base_url=BASE_URL) as client:
        # 1. Create Project
        print("Creating Project...")
        res = client.post("/projects/", json={
            "project_code": f"DEMO-HPLC-{int(time.time())}",
            "project_name": "HPLC Analytical Method Development",
            "description": "DEMO / SYNTHETIC DATA: HPLC Method for standard mixture."
        })
        if res.status_code != 201:
            print("Project creation failed:", res.text)
            return
        project_id = res.json()["id"]

        # 2. Create ATP
        print("Creating ATP...")
        client.post(f"/projects/{project_id}/atp/", json={
            "name": "Resolution",
            "target_type": "MINIMUM",
            "lower_limit": 2.0,
            "unit": "",
            "criticality": "Critical"
        })

        # 3. Create Risk Assessment
        print("Creating Risk Assessment...")
        client.post(f"/projects/{project_id}/risk/", json={
            "parameter": "pH buffer preparation",
            "potential_impact": "Changes retention time",
            "severity": 7,
            "occurrence": 3,
            "detectability": 2,
            "justification": "Standard buffer check"
        })

        # 4. Create Factors
        print("Creating Factors...")
        client.post(f"/projects/{project_id}/factors/", json={
            "code": "A", "name": "pH", "type": "CONTINUOUS", "role": "CRITICAL",
            "low_value": 4.0, "high_value": 6.0, "levels": 2
        })
        client.post(f"/projects/{project_id}/factors/", json={
            "code": "B", "name": "Flow Rate", "type": "CONTINUOUS", "role": "CRITICAL",
            "low_value": 0.8, "high_value": 1.2, "levels": 2
        })
        client.post(f"/projects/{project_id}/factors/", json={
            "code": "C", "name": "Organic Phase %", "type": "CONTINUOUS", "role": "CRITICAL",
            "low_value": 40.0, "high_value": 60.0, "levels": 2
        })

        # 5. Create Responses
        print("Creating Responses...")
        res_r1 = client.post(f"/projects/{project_id}/responses/", json={
            "code": "R1", "name": "Resolution", "target_type": "MAXIMIZE", "importance": 5, "lower_limit": 2.0
        }).json()
        res_r2 = client.post(f"/projects/{project_id}/responses/", json={
            "code": "R2", "name": "Tailing Factor", "target_type": "MINIMIZE", "importance": 4, "upper_limit": 1.2
        }).json()
        res_r3 = client.post(f"/projects/{project_id}/responses/", json={
            "code": "R3", "name": "Retention Time", "target_type": "RANGE", "importance": 3, "lower_limit": 5.0, "upper_limit": 6.0
        }).json()

        # 6. Generate DOE (BBD for 3 factors)
        print("Generating DOE (BBD)...")
        res_doe = client.post(f"/projects/{project_id}/doe/", json={
            "design_type": "BBD",
            "center_points": 3
        })
        design_id = res_doe.json()["id"]

        # 7. Add Data
        print("Adding Experimental Data...")
        runs = client.get(f"/doe/{design_id}/runs/").json()
        
        # Synthetic mock data
        # R1: resolution, R2: tailing, R3: rt
        for i, run in enumerate(runs):
            # Just create some semi-realistic numbers
            ph = run["factor_values"]["A"]
            flow = run["factor_values"]["B"]
            org = run["factor_values"]["C"]
            
            res_val = 1.5 + (ph - 4.0)*0.5 + (1.2 - flow)*1.0
            tail = 1.0 + (flow - 0.8)*0.5
            rt = 10.0 - (org - 40)*0.1 - (flow)*2.0
            
            client.put(f"/experiments/{run['id']}", json={
                "response_values": {
                    "Resolution": round(res_val, 2),
                    "Tailing Factor": round(tail, 2),
                    "Retention Time": round(rt, 2)
                }
            })

        # 8. Run Analysis
        print("Running Statistical Analysis...")
        ana1 = client.post(f"/projects/{project_id}/analysis/", json={
            "design_id": design_id,
            "response_id": res_r1["id"],
            "model_type": "QUADRATIC"
        }).json()
        
        ana2 = client.post(f"/projects/{project_id}/analysis/", json={
            "design_id": design_id,
            "response_id": res_r2["id"],
            "model_type": "FIRST_ORDER"
        }).json()

        # 9. Optimization
        print("Running Optimization...")
        opt = client.post(f"/projects/{project_id}/optimization/", json={
            "analysis_ids": [ana1["id"], ana2["id"]],
            "settings": {"method": "desirability"}
        }).json()

        # 10. Report
        print("Generating Report...")
        client.post(f"/projects/{project_id}/reports/")

        print("Demo project successfully created!")

if __name__ == "__main__":
    run_demo_creation()
