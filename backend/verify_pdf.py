import sys
import httpx
from pypdf import PdfReader

# Trigger report generation
print("Triggering report generation...")
res = httpx.post("http://localhost:8000/api/v1/projects/4/reports/")
res.raise_for_status()
data = res.json()
filepath = data['file_path']
print(f"Generated report at: {filepath}")

# Since it's running in docker, we might not be able to read it directly if the path is relative to the container.
# Wait, generated_reports/ is inside the backend directory. Let's find it locally.
import os
local_filepath = os.path.join("backend", filepath)
if not os.path.exists(local_filepath):
    # Try looking for it
    import glob
    files = glob.glob("backend/generated_reports/*.pdf")
    if files:
        files.sort(key=os.path.getmtime, reverse=True)
        local_filepath = files[0]
        print(f"Found latest report at {local_filepath}")
    else:
        print("Could not find generated report locally.")
        sys.exit(1)

print("Reading PDF...")
reader = PdfReader(local_filepath)
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

print("--- PDF CONTENT ---")
print(text[:4000]) # Print first 4000 chars to check
print("--- END CONTENT ---")

# Let's verify some key things
checks = [
    "AQbD Studio V1 (ICH-Aligned)",
    "Aligned with ICH Q8/Q9/Q14 Enhanced Lifecycle Guidelines.",
    "Active Response Models:",
    "historical/superseded model fits are archived",
    "Active Design (ID",
    "Active Multi-Response Optimal Solution (Run #",
    "Full 3D Design Space Analysis (Run #",
    "Software Verification Passed",
]

for check in checks:
    if check in text:
        print(f"[OK] Found: {check}")
    else:
        print(f"[FAIL] Missing: {check}")

