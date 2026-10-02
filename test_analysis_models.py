import urllib.request
import json
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE = 'http://localhost:8000/api/v1'

def test_fit(resp_id, resp_name, model_type, transf='NONE'):
    payload = {
        'design_id': 13,
        'response_id': resp_id,
        'model_type': model_type,
        'transformation': transf
    }
    req = urllib.request.Request(
        f'{BASE}/projects/4/analysis/',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read())
            print(f"[SUCCESS] {resp_name} | {model_type} | {transf}:")
            print(f"   R²={data['metrics'].get('r_squared')}, RMSE={data['metrics'].get('rmse')}, Coefs={len(data['coefficients'])}, ANOVA rows={len(data['anova'])}")
            for c in data['coefficients'][:2]:
                print(f"     Term: {c['term']}, coef={c['coef']}, se={c.get('se')}, std_err={c.get('std_err')}, t_stat={c.get('t_stat')}, p_value={c.get('p_value')}")
            for a in data['anova'][:2]:
                print(f"     ANOVA: {a['source']}, SS={a.get('sum_sq')}, F={a.get('F')}, p_value={a.get('p_value')}")
            return True
    except Exception as e:
        print(f"[FAIL] {resp_name} | {model_type}: {e}")
        return False

print("=" * 60)
print("TESTING USER-SPECIFIED ANALYSIS COMBINATIONS ON PROJECT 4")
print("=" * 60)

print("\n--- Test 1: Resolution (Y1) First Order ---")
test_fit(11, 'Resolution (Y1)', 'FIRST_ORDER')

print("\n--- Test 2: Resolution (Y1) Interactions ---")
test_fit(11, 'Resolution (Y1)', 'INTERACTIONS')

print("\n--- Test 3: Resolution (Y1) Quadratic ---")
test_fit(11, 'Resolution (Y1)', 'QUADRATIC')

print("\n--- Test 4: Y2 Tailing Factor (First Order, Interactions, Quadratic) ---")
test_fit(12, 'Y2 Tailing Factor', 'FIRST_ORDER')
test_fit(12, 'Y2 Tailing Factor', 'INTERACTIONS')
test_fit(12, 'Y2 Tailing Factor', 'QUADRATIC')

print("\n--- Test 5: Y3 Retention Time (First Order, Interactions, Quadratic) ---")
test_fit(13, 'Y3 Retention Time', 'FIRST_ORDER')
test_fit(13, 'Y3 Retention Time', 'INTERACTIONS')
test_fit(13, 'Y3 Retention Time', 'QUADRATIC')

print("\n--- Test 6: Y4 Theoretical Plates (First Order, Interactions, Quadratic) ---")
test_fit(14, 'Y4 Theoretical Plates', 'FIRST_ORDER')
test_fit(14, 'Y4 Theoretical Plates', 'INTERACTIONS')
test_fit(14, 'Y4 Theoretical Plates', 'QUADRATIC')

print("\n" + "=" * 60)
print("ALL REQUESTED MODEL SPECIFICATIONS TESTED")
print("=" * 60)
