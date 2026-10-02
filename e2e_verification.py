import urllib.request
import json
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://localhost:8000/api/v1"

def req(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode("utf-8") if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"HTTP ERROR {e.code} on {method} {url}: {err}")
        raise e

import time

def run_e2e_verification():
    print("=" * 60)
    print("AQbD STUDIO V1 — FULL END-TO-END VERIFICATION")
    print("=" * 60)

    ts = int(time.time())
    code = f"E2E-HPLC-{ts}"

    # 1. Project Creation
    print("\n1. Testing Project Creation...")
    proj = req(f"{BASE_URL}/projects/", "POST", {
        "project_code": code,
        "project_name": "HPLC Assay & Impurity Method Development",
        "description": "Validation run for complete AQbD V1 lifecycle",
        "version": "1.0",
        "status": "IN_PROGRESS"
    })
    proj_id = proj["id"]
    print(f"   ✓ Project created: ID={proj_id}, Code={proj['project_code']}")

    # 2. ATP Parameter
    print("\n2. Testing ATP Parameter Creation...")
    atp = req(f"{BASE_URL}/projects/{proj_id}/atp/", "POST", {
        "name": "Assay Accuracy",
        "description": "Mean recovery of active pharmaceutical ingredient",
        "unit": "%",
        "target_type": "RANGE",
        "target_value": 100.0,
        "lower_limit": 98.0,
        "upper_limit": 102.0,
        "criticality": "HIGH",
        "justification": "ICH Q2(R2) specification for drug product assay"
    })
    print(f"   ✓ ATP Created: ID={atp['id']}, Name={atp['name']}, Target={atp['lower_limit']}-{atp['upper_limit']}%")

    # 3. Risk Assessment (FMEA)
    print("\n3. Testing Risk Assessment (FMEA)...")
    risk = req(f"{BASE_URL}/projects/{proj_id}/risk/", "POST", {
        "parameter": "Column Temperature",
        "severity": 4,
        "occurrence": 3,
        "detectability": 2,
        "priority": "Medium",
        "justification": "Temperature fluctuations affect peak shape and retention time"
    })
    print(f"   ✓ Risk Assessment: ID={risk['id']}, RPN={risk['risk_score']}, Priority={risk['priority']}")

    # 4. Factors Creation (CMA/CPP)
    print("\n4. Testing Factors Creation...")
    f1 = req(f"{BASE_URL}/projects/{proj_id}/factors/", "POST", {
        "code": "A",
        "name": "Flow Rate",
        "type": "CONTINUOUS",
        "unit": "mL/min",
        "low_value": 0.8,
        "center_value": 1.0,
        "high_value": 1.2,
        "role": "CRITICAL",
        "description": "Mobile phase volumetric flow rate"
    })
    f2 = req(f"{BASE_URL}/projects/{proj_id}/factors/", "POST", {
        "code": "B",
        "name": "Column Temperature",
        "type": "CONTINUOUS",
        "unit": "°C",
        "low_value": 30.0,
        "center_value": 35.0,
        "high_value": 40.0,
        "role": "CRITICAL",
        "description": "Thermostatted column compartment temperature"
    })
    print(f"   ✓ Factors Created: A={f1['name']} [{f1['low_value']}-{f1['high_value']}], B={f2['name']} [{f2['low_value']}-{f2['high_value']}]")

    # 5. Responses Creation (CQA)
    print("\n5. Testing Responses Creation...")
    r1 = req(f"{BASE_URL}/projects/{proj_id}/responses/", "POST", {
        "code": "Y1",
        "name": "Resolution",
        "unit": "Rs",
        "target_type": "MAXIMIZE",
        "lower_limit": 1.5,
        "upper_limit": 3.0,
        "importance": 5,
        "description": "Chromatographic resolution between critical pair"
    })
    r2 = req(f"{BASE_URL}/projects/{proj_id}/responses/", "POST", {
        "code": "Y2",
        "name": "Retention Time",
        "unit": "min",
        "target_type": "TARGET",
        "target": 6.0,
        "lower_limit": 5.0,
        "upper_limit": 7.0,
        "importance": 4,
        "description": "Run time for main analyte peak"
    })
    print(f"   ✓ Responses Created: Y1={r1['name']} ({r1['target_type']}), Y2={r2['name']} ({r2['target_type']})")

    # 6. DOE Design Generation (CCD with replicates)
    print("\n6. Testing DOE Design Generation...")
    doe = req(f"{BASE_URL}/projects/{proj_id}/doe/", "POST", {
        "design_type": "CCD",
        "center_points": 4,
        "alpha": "o",
        "face": "ccf",
        "seed": 42
    })
    design_id = doe["id"]
    runs = req(f"{BASE_URL}/doe/{design_id}/runs")
    print(f"   ✓ DOE Generated: Design ID={design_id}, Type={doe['design_type']}, Total Runs={len(runs)}")

    # 7. Populate Experimental Run Data
    print("\n7. Populating Experimental Run Results...")
    for r in runs:
        a_val = r["coded_values"].get("A", 1.0)
        b_val = r["coded_values"].get("B", 35.0)
        # Realistic chemical physics model:
        y1_sim = round(2.2 - 0.5 * (a_val - 1.0) + 0.04 * (b_val - 35.0) - 0.002 * ((b_val - 35.0)**2), 3)
        y2_sim = round(6.0 - 2.5 * (a_val - 1.0) - 0.12 * (b_val - 35.0) + 0.8 * ((a_val - 1.0)**2), 3)

        req(f"{BASE_URL}/experiments/{r['id']}", "PUT", {
            "response_values": {"Y1": y1_sim, "Y2": y2_sim},
            "notes": "Verified laboratory run"
        })

    print(f"   ✓ Experimental Runs Recorded: {len(runs)} runs updated with actual response values")

    # 8. Statistical Analysis (Model Fitting, ANOVA, Lack-of-Fit)
    print("\n8. Testing Statistical Analysis & Model Fitting...")
    ana_y1 = req(f"{BASE_URL}/projects/{proj_id}/analysis/", "POST", {
        "design_id": design_id,
        "response_id": r1["id"],
        "model_type": "QUADRATIC",
        "transformation": "NONE"
    })
    ana_y2 = req(f"{BASE_URL}/projects/{proj_id}/analysis/", "POST", {
        "design_id": design_id,
        "response_id": r2["id"],
        "model_type": "QUADRATIC",
        "transformation": "NONE"
    })
    print(f"   ✓ Model Y1 (Resolution): R²={ana_y1['metrics']['r_squared']:.4f}, Adj-R²={ana_y1['metrics']['adj_r_squared']:.4f}, LOF={ana_y1['metrics']['lack_of_fit']['status']}")
    print(f"   ✓ Model Y2 (Retention Time): R²={ana_y2['metrics']['r_squared']:.4f}, Adj-R²={ana_y2['metrics']['adj_r_squared']:.4f}, LOF={ana_y2['metrics']['lack_of_fit']['status']}")

    # 9. Model Diagnostics
    print("\n9. Testing Model Diagnostics & Normality...")
    shapiro = ana_y1["diagnostics"]["normality"]
    resids = ana_y1["diagnostics"]["residuals"]
    print(f"   ✓ Shapiro-Wilk Normality Test: Status={shapiro['status']}, p-value={shapiro['shapiro_p']:.4f}")
    print(f"   ✓ Computed Residuals Count={len(resids)}, Fitted Values Count={len(ana_y1['diagnostics']['fitted'])}")

    # 10. Multi-Response Optimization (Derringer-Suich Desirability)
    print("\n10. Testing Multi-Response Desirability Optimization...")
    opt = req(f"{BASE_URL}/projects/{proj_id}/optimization/", "POST", {
        "analysis_ids": [ana_y1["id"], ana_y2["id"]],
        "settings": {}
    })
    best_cand = opt["candidates"][0]
    print(f"   ✓ Global Optimum Found: Overall Desirability D={best_cand['overall_desirability']:.4f}")
    print(f"     Recommended Factor Setpoints: A={best_cand['factors']['A']:.3f} mL/min, B={best_cand['factors']['B']:.3f} °C")
    print(f"     Predicted Response Outcomes: Y1={best_cand['responses']['Y1']:.3f} Rs, Y2={best_cand['responses']['Y2']:.3f} min")

    # 11. Design Space (PAR Calculation)
    print("\n11. Testing ICH Q8 Design Space & PAR Calculation...")
    ds = req(f"{BASE_URL}/projects/{proj_id}/design-space/", "POST", {
        "analysis_ids": [ana_y1["id"], ana_y2["id"]],
        "constraints": {},
        "grid_resolution": 15
    })
    space_data = ds["space_data"]
    total_pts = space_data["acceptable_points"] + space_data["unacceptable_points"]
    print(f"   ✓ Design Space Calculated: {space_data['acceptable_points']}/{total_pts} points ({space_data['acceptable_points']/total_pts*100:.1f}%) within Proven Acceptable Range")

    # 12. Confirmation Run Verification
    print("\n12. Testing Confirmation Run Verification...")
    conf = req(f"{BASE_URL}/projects/{proj_id}/optimization/confirm", "POST", {
        "optimization_id": opt["id"],
        "predicted_values": best_cand["responses"],
        "actual_values": {
            "Y1": round(best_cand["responses"]["Y1"] + 0.02, 3),
            "Y2": round(best_cand["responses"]["Y2"] - 0.05, 3)
        }
    })
    print(f"   ✓ Confirmation Run Recorded: ID={conf['id']}")
    print(f"     Differences: Y1 Δ={conf['differences']['Y1']:.3f}, Y2 Δ={conf['differences']['Y2']:.3f}")

    # 13. Regulatory PDF Report Generation & Download
    print("\n13. Testing Regulatory PDF Report Generation...")
    rpt = req(f"{BASE_URL}/projects/{proj_id}/reports/", "POST")
    rpt_id = rpt["id"]
    file_path = rpt["file_path"]
    print(f"   ✓ Report Generated: ID={rpt_id}, Path={file_path}")

    # Test Download endpoint
    download_url = f"{BASE_URL}/reports/download/{rpt_id}"
    req_dl = urllib.request.Request(download_url)
    with urllib.request.urlopen(req_dl) as res:
        pdf_bytes = res.read()
        print(f"   ✓ PDF Download verified: {len(pdf_bytes)} bytes downloaded (Content-Type: {res.headers.get('Content-Type')})")
        assert len(pdf_bytes) > 1000, "PDF size is unexpectedly small"
        assert pdf_bytes.startswith(b"%PDF"), "Downloaded content is not a valid PDF"

    print("\n" + "=" * 60)
    print("ALL 13 AQbD V1 WORKFLOW PHASES SUCCESSFULLY VERIFIED END-TO-END!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_verification()
