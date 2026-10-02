import os

readme_content = """# AQbD Studio V1

## 1. Project Overview

AQbD Studio is an ICH Q8/Q9/Q14-aligned analytical method development software prototype/application.

It exists to provide a systematic, statistical, and risk-based approach to analytical method development, moving beyond traditional trial-and-error (One-Factor-at-a-Time, OFAT) methodologies. The problem it solves is the lack of structured, accessible software that strictly enforces the Quality by Design (QbD) workflow specifically tailored for analytical methods (AQbD).

It is intended for analytical scientists, method developers, and researchers in the pharmaceutical and chemical industries.

The application covers the complete AQbD workflow, progressing from the initial Analytical Target Profile (ATP) through risk assessment, Design of Experiments (DOE), statistical modeling, multi-response optimization, Design Space calculation, and finally simulated confirmation.

Current V1 scope provides an end-to-end prototype supporting full factorial, fractional factorial, and response surface designs, paired with a robust OLS regression engine, Derringer-Suich desirability optimization, and multidimensional feasible design space evaluation. What makes it different from a simple CRUD application is its embedded scientific and statistical engine—it genuinely calculates regressions, ANOVA, optimizations, and multidimensional feasible grids based on the user's data.

## 2. AQbD CONCEPT — BEGINNER EXPLANATION

**Analytical Quality by Design (AQbD)** is a systematic approach to analytical method development that begins with predefined objectives and emphasizes product and process understanding based on sound science and quality risk management.

*   **Analytical Target Profile (ATP):** The goalpost. It defines what the method needs to measure and the criteria for success (e.g., must measure paracetamol with specific precision).
*   **Critical Quality Attributes / responses (CQAs):** The actual outputs we measure to judge the method's performance (e.g., Resolution, Tailing Factor, Retention Time).
*   **Critical factors / parameters (CPPs):** The inputs we can change in the laboratory (e.g., Mobile Phase Composition, Flow Rate, Column Temperature).
*   **Risk assessment:** Evaluating which factors are most likely to negatively impact our responses.
*   **DOE (Design of Experiments):** A structured mathematical plan of which specific combinations of factors to test in the lab to get the maximum information with the minimum number of experiments.
*   **Regression model:** A mathematical equation (like `Y = mx + b`, but in multiple dimensions) that describes the relationship between factors and a response.
*   **ANOVA (Analysis of Variance):** A statistical test used to prove whether our regression model actually fits the data well or if it's just random noise.
*   **Diagnostics:** Visual plots (like Residuals vs Fitted) used to check if the mathematical assumptions of our regression model are correct.
*   **Optimization:** Using mathematics to find the exact "sweet spot" combination of factors that satisfies all our response goals simultaneously.
*   **Desirability:** A mathematical score between 0 and 1 that grades how well a prediction meets our goals. 1 is perfect, 0 is a failure.
*   **Design Space (PAR):** The multidimensional "safe zone" or Proven Acceptable Range. If you operate your method anywhere inside this zone, you are statistically guaranteed to meet all your goals.
*   **Confirmation run:** A final experiment performed in the lab using the optimized settings to prove the software's predictions were correct.

**The Complete Lifecycle:**
ATP → Risk Assessment → Factors → Responses → DOE → Experiments → Statistical Modeling → Diagnostics → Optimization → Design Space → Confirmation → Report

For every phase:
*   **Input:** The user defines parameters (e.g., high/low limits for factors) or provides data.
*   **What software does:** Validates, processes, or performs heavy mathematical computations (like OLS regression or grid evaluations).
*   **Output:** Statistical metrics, interactive plots, or optimized setpoints.
*   **Why it matters:** Each phase mathematically builds upon the previous one to ensure the final method is robust and scientifically justified.

## 3. COMPLETE APPLICATION WORKFLOW

The actual AQbD Studio V1 workflow is divided into strict phases:

1.  **Phase 1 — Dashboard / Project:** Define project metadata.
2.  **Phase 2 — ATP:** Define the ultimate goal of the method.
3.  **Phase 3 — Risk Assessment:** Evaluate factor risks using an FMEA (Failure Mode and Effects Analysis) matrix.
4.  **Phase 4 — Factors:** Define the independent variables (CPPs) and their operating ranges.
5.  **Phase 5 — Responses:** Define the dependent variables (CQAs) and their target criteria.
6.  **Phase 6 — DOE:** Generate a statistical experimental plan.
7.  **Phase 7 — Experiments / Analysis / Diagnostics:** Input experimental results, fit regression models, view ANOVA, and check diagnostic plots.
8.  **Phase 8 — Optimization:** Run desirability algorithms to find the optimal factor setpoint.
9.  **Phase 9 — Design Space:** Calculate the multidimensional Proven Acceptable Range (PAR).
10. **Phase 10 — Confirmation:** Compare optimized predictions against empirical observations (or software simulations).
11. **Phase 11 — Reports:** Generate an ICH Q8/Q9/Q14-aligned analytical method development dossier PDF.

Data flows linearly. Factors and Responses dictate the DOE. The DOE dictates the Experiments. Experiments drive the Analysis. Analysis equations drive Optimization and Design Space. Everything converges into the Report.

```text
[Project Definition] -> [ATP & Risk] -> [Factors & Responses] -> [DOE Generation]
                                                                        |
                                                                        v
[Report Generation] <- [Confirmation] <- [Design Space] <- [Optimization] <- [Experiments & Analysis]
```

## 4. SYSTEM ARCHITECTURE

AQbD Studio V1 uses a modern decoupled architecture.

**Frontend:**
*   React
*   TypeScript
*   Vite
*   Tailwind CSS
*   Plotly.js (for scientific diagnostic and 3D surface visualizations)
*   TanStack Query (for asynchronous state management and API caching)

**Backend:**
*   Python
*   FastAPI (RESTful API framework)
*   Pydantic (data validation)
*   Pandas & NumPy (data manipulation and matrix operations)
*   SciPy & Statsmodels (core OLS regression and statistical testing)
*   pyDOE3 (Design of Experiments matrix generation)

**Database:**
*   SQLite (currently used for V1 prototyping and local portability)
*   *PostgreSQL is the intended future direction for production multi-user deployment.*

**Reporting:**
*   ReportLab (for dynamic, structured PDF generation)

**Deployment:**
*   Docker & Docker Compose (containerized microservices)

**Flow:** 
The React frontend makes HTTP requests to FastAPI endpoints. The FastAPI route handlers validate the payload using Pydantic, then pass the data to dedicated `service.py` modules. The service modules perform the heavy scientific/statistical logic using Statsmodels/SciPy, map the results back to DTOs, commit state to the SQLite database via SQLAlchemy, and return JSON responses to the frontend.

*Why is statistical logic separate from route handlers?*
To ensure testability and maintainability. Route handlers only deal with HTTP parsing and database I/O. The actual mathematics (ANOVA, desirability, matrix transformations) are isolated in pure Python service layers, meaning they can be unit-tested without needing a web request context.

## 5. PROJECT DIRECTORY STRUCTURE

```text
aqbd/
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # Phase 1-11 UI components (e.g., Reports.tsx, Optimization.tsx)
│   │   ├── components/   # Reusable UI widgets
│   │   └── ...
├── backend/              # FastAPI Application
│   ├── analysis/         # Regression, ANOVA, diagnostics logic
│   ├── atp/              # ATP endpoints
│   ├── core/             # Database connection, config
│   ├── design_space/     # Multidimensional grid evaluation
│   ├── doe/              # Matrix generation via pyDOE3
│   ├── experiments/      # Data entry and hashing
│   ├── factors/          # Factor definitions
│   ├── optimization/     # Derringer-Suich algorithms
│   ├── projects/         # Core project wrappers
│   ├── reports/          # ReportLab PDF generation (service.py, routes.py)
│   ├── responses/        # Response criteria
│   ├── risk/             # FMEA logic
│   └── tests/            # Pytest suites
├── docker-compose.yml    # Orchestration configuration
├── Dockerfile            # Container definitions
└── README.md             # This manual
```

## 6. DATABASE / DATA MODEL

**Key Entities:**

*   **Project:** The root container. Everything cascades from here via `project_id`.
*   **ATPParameter:** Stores method objectives.
*   **RiskAssessment:** FMEA matrix scores (Severity, Occurrence, Detectability).
*   **Factor:** Independent variables. Contains coded representations and actual `low_value`/`high_value` bounds.
*   **ResponseModel:** Dependent variables. Contains the `target_type` (MAXIMIZE, MINIMIZE, TARGET, RANGE) and limits.
*   **DOEDesign:** Stores the generated statistical matrix (`standard_order`) and the `random_seed`.
*   **Analysis:** Stores fitted regression metrics, ANOVA tables, coefficients, and the `is_stale` flag.
*   **OptimizationRun:** Stores the calculated optimal setpoints (`candidates`).
*   **DesignSpace:** Stores the multidimensional grid evaluation (`space_data`).
*   **ConfirmationRun:** Stores predicted vs. actual values and the critical `data_source` flag (`SIMULATED` vs `EXPERIMENTAL`).

**Important Concepts:**
*   **Dataset Hash:** A SHA-256 footprint of the experimental data used to track data mutations.
*   **Stale Analysis:** A flag indicating a regression model is obsolete because the underlying experimental data was altered.
*   **Current vs Historical Records:** AQbD Studio archives every optimization or model fit but strictly filters `is_stale == False` for the active working state and PDF reports.

## 7. DATA VERSIONING & STALE MODEL PROTECTION

AQbD Studio employs a strict data versioning system to prevent scientific invalidation.

**How it works:**
1.  When experimental results are saved, the backend calculates a **SHA-256 hash** of the dataset (the exact values of all factors and responses).
2.  When a regression model is fitted (Analysis), this hash is stored alongside the model.
3.  If a user modifies *any* experimental data point and hits save, a new hash is generated.
4.  The system scans all existing analyses. Any analysis whose hash no longer matches the current dataset hash is flagged as `is_stale = True`.

**Why this matters:**
Changing data invalidates the mathematical equation. The software actively prevents the Optimization or Design Space engines from using stale models, throwing a strict `STALE_ANALYSIS` error contract. The frontend detects this and forces the user to refit the models, ensuring optimization is always derived from the exact current state of the laboratory data.

## 8. DOE ENGINE

**Supported DOE Types:**
*   Full Factorial
*   General Factorial
*   Central Composite Design (CCD)
*   Box-Behnken Design (BBD)

The DOE engine utilizes coded variables (-1 for low, +1 for high, 0 for center). This orthogonal coding is critical for scaling coefficients equally during regression.
The engine supports randomization driven by a random seed.

**Example (Current Verified State):**
Design #13 is a Full Factorial design consisting of 11 runs with Seed 43. Changing the seed changes the run order, but reusing Seed 43 guarantees the exact same matrix is regenerated, ensuring absolute scientific reproducibility.

## 9. EXPERIMENTAL DATA

Experimental runs are generated as empty shells by the DOE engine. The user inputs the response observations.

**REAL VS SIMULATED DATA:**
*   **Real User Experimental Data:** Data empirically obtained in a laboratory.
*   **Simulated Test Data:** For development and demonstration purposes, AQbD Studio includes a synthetic test data generator. *This generator creates mathematically coherent HPLC-like offsets purely to demonstrate software functionality. It does NOT represent real laboratory evidence.*

## 10. STATISTICAL MODELING

The core OLS regression engine supports three model types:

*   **FIRST_ORDER:** Linear relationships.
    `Y = β0 + β1X1 + β2X2 + β3X3`
*   **INTERACTIONS:** Linear + 2-way cross interactions (synergistic/antagonistic effects).
    `Y = β0 + ΣβiXi + ΣβijXiXj`
*   **QUADRATIC:** Linear + Interactions + Curvature (requires center points/surface designs).
    `Y = β0 + ΣβiXi + ΣβijXiXj + ΣβiiXi²`

All mathematics are performed in the coded coordinate system `(-1 to +1)` to prevent unit magnitude bias (e.g., % vs mL/min).

## 11. ANOVA & MODEL METRICS

AQbD Studio calculates comprehensive model metrics:

*   **R² (Coefficient of Determination):** How much variance the model explains.
*   **Adjusted R²:** R² penalized for adding unnecessary terms.
*   **Predicted R²:** How well the model predicts *new* data (calculated via the PRESS statistic).
*   **PRESS:** Predicted Residual Error Sum of Squares.
*   **RMSE:** Root Mean Square Error.
*   **ANOVA:** Analysis of Variance tables including p-values to determine statistical significance.
*   **Lack of Fit:** Calculated if pure error is estimable (e.g., if center point replicates exist).

*Note: High R² alone does not automatically prove a model is scientifically adequate. Predicted R² and residual diagnostics must be evaluated.*

## 12. DIAGNOSTICS

To verify mathematical assumptions, the system generates interactive Plotly diagnostics:

*   **Residuals vs Fitted:** Checks for homoscedasticity (constant variance).
*   **Residuals vs Run Order:** Checks for lurking time-based variables.
*   **Actual vs Predicted:** Checks overall fit quality.
*   **Residual Histogram / Q-Q Plot:** Checks for normality of errors.
*   **Contour & Response Surface:** Visualizes the mathematical equation.

*Important Engineering Note:* Predictions and visualizations actively transform user actual coordinates back into coded coordinates `coded = (actual - center) / ((high - low) / 2)` before feeding them to the statsmodels prediction engine, as the models are strictly fitted in coded space.

## 13. OPTIMIZATION ENGINE

The software utilizes Derringer-Suich multi-response desirability functions.

For each response, an individual desirability `d_i` (0 to 1) is calculated based on its goal:
*   **MAXIMIZE:** Ramps from 0 at the lower limit to 1 at the target.
*   **MINIMIZE:** Ramps from 1 at the lower limit to 0 at the upper limit.
*   **TARGET:** Peaks at 1 at the exact target, ramping to 0 at both limits.

**Overall Desirability (D)** is the geometric mean of all `d_i`. If *any* response fails its criteria (`d_i = 0`), the overall desirability becomes exactly 0 (strict failure).

**Current Verified Optimization (Run #25):**
*   A = 66.271%
*   B = 0.800 mL/min
*   C = 35.000°C
*   **D = 0.6253**
*   *Predicted Resolution = 2.599, Tailing = 1.101, Retention = 5.324, Plates = 2698.378*
*(These are model predictions, not laboratory observations).*

## 14. DESIGN SPACE

The software calculates a multidimensional grid.

*   **Investigated DOE range:** The boundaries we tested (e.g., A: 60-70).
*   **2D Slice:** A visual cross-section holding one variable constant.
*   **Full 3D Design Space:** Evaluating the *entire* cubic volume (e.g., 20x20x20 grid = 8,000 vertices).
*   **Projected Feasible Span (PAR):** The min/max feasible extremes.

**Current Implementation State:**
*   8,000 grid vertices evaluated.
*   6,234 acceptable / 1,766 unacceptable (77.9% feasible).
*   Spans: A (60–70%), B (0.8–1.2 mL/min), C (25–35°C).

*Critical scientific rule:* Projected spans are a bounding envelope, not an uncoupled Cartesian box. Operating near the extreme corners of these spans may still fail constraints due to multifactorial interactions. Zero extrapolation is permitted.

## 15. CONFIRMATION RUN

The confirmation phase compares the optimization setpoint predictions against laboratory reality.

*   **SIMULATED:** Created via the "Auto-fill with Predicted Values" feature. Labeled strictly as "Software Verification Passed".
*   **EXPERIMENTAL:** Created when a user manually enters real lab observations. Only this can achieve the "Model Validated" verdict.

*Explicitly: Simulated confirmation does NOT constitute empirical laboratory confirmation.*

## 16. PDF REPORT GENERATION

The final phase compiles an ICH Q8/Q9/Q14-aligned analytical method development dossier PDF.

The generation engine strictly filters the database to include only **active/current** elements (active DOE, non-stale models, latest optimization run, latest Design Space). Historical records are excluded from the main flow to prevent contaminating the active dossier with obsolete prototyping data. Regulatory wording is restricted to "aligned" rather than falsely claiming official "compliance" or "certification".

## 17. CURRENT VERIFIED PROJECT STATE

**Current V1 Verification Snapshot**
*   **Active DOE:** Design #13 | Full Factorial | 11 runs | Seed 43
*   **Current Models:** #25–#28 (Resolution, Tailing Factor, Retention Time, Theoretical Plates)
*   **Optimization:** Run #25 | D = 0.6253 | A = 66.271, B = 0.800, C = 35.000
*   **Design Space:** Run #34 | 8,000 points | 6,234 acceptable (77.9%)
*   **Confirmation:** CR-3 to CR-6 (SIMULATED)
*   **Tests:** 23/23 Backend Pytest tests passing. Frontend Vite build successful.

## 18. WHAT IS REAL VS SIMULATED

| Feature | Real Implementation | Simulated/Test |
| :--- | :--- | :--- |
| DOE generation | Real | — |
| Regression Modeling | Real | — |
| ANOVA & Diagnostics | Real | — |
| Desirability Optimization | Real | — |
| 3D Design Space calculation | Real | — |
| PDF Report Generation | Real | — |
| Synthetic experiment generator | — | Test data |
| Confirmation auto-fill | — | Simulation |
| Actual laboratory validation | Requires user lab data | Not provided by software |

## 19. LIMITATIONS / NOT YET IMPLEMENTED

As a V1 software prototype, the following are **NOT** implemented:
*   Regulatory electronic records compliance (21 CFR Part 11)
*   Audit trails or Electronic Signatures
*   User authentication / Multi-tenant authorization
*   Real laboratory instrument integration (e.g., direct Empower/Chromeleon linkage)
*   PostgreSQL production database (currently using local SQLite)

## 20. LOCAL DEVELOPMENT SETUP

**Prerequisites:** Node.js, npm, Docker Desktop

**Startup:**
```bash
docker compose up
```
*   Frontend: `http://localhost:3000`
*   Backend: `http://localhost:8000`

**Shutdown:**
```bash
docker compose down
```
*Note: Vite HMR and FastAPI reloading are configured via volume mounts in docker-compose.yml for live development.*

## 21. TESTING & VERIFICATION

To verify mathematical logic and API integrity:

**Backend (Pytest):**
```bash
docker compose exec -T backend pytest
```
*Verifies regression engines, desirability bounds, design space logic, and route contracts.*

**Frontend (Build Check):**
```bash
docker compose exec -T frontend npm run build
```
*Verifies TypeScript typings and React component compilation.*

## 22. TROUBLESHOOTING

*   **Problem:** PDF metrics showing N/A.
    *   *Cause:* Legacy schema referenced `R2` instead of the database column `r_squared`.
    *   *Fix:* Updated the `backend/reports/service.py` to use `a.get("metrics").get("r_squared")`.
*   **Problem:** Stale Analysis / Blank Analysis page.
    *   *Cause:* You modified a value in the Experiments table, which altered the dataset SHA-256 hash, setting `is_stale = True` on existing models.
    *   *Fix:* Navigate to Analysis and refit the models for all responses.
*   **Problem:** Coded/Actual contour mismatch.
    *   *Cause:* Plotting predictions directly on actual bounds without inverse coding.
    *   *Fix:* Ensure `backend/analysis/service.py` applies `(val - center) / half_range` before prediction.
*   **Problem:** PDF contains historical models.
    *   *Cause:* The report generator looped over all analyses instead of filtering for `is_stale == False`.
    *   *Fix:* Update the PDF router to explicitly isolate active models.

## 23. HOW TO EXPLAIN AQBD STUDIO TO SOMEONE ELSE

**2-Minute Elevator Pitch:**
"What goes in?" -> You input what your analytical method needs to achieve (ATP) and limits of the variables you can change (Factors).
"What happens?" -> The software statistically generates an experimental plan (DOE). You do the lab work, enter the results, and the software builds a mathematical multidimensional model of your method.
"What comes out?" -> It spits out the exact optimal instrument settings and a 'safe zone' (Design Space) where you are mathematically guaranteed to succeed, bundled into a regulatory-aligned PDF report.

**5-Minute Technical Deep Dive:**
AQbD Studio is a React/FastAPI stack. You define critical quality attributes and parameters, and we use `pyDOE3` to generate an orthogonal matrix. Once experimental data is entered, our Python service layer uses `statsmodels` to run Ordinary Least Squares (OLS) regressions in a normalized coded coordinate space. We validate these equations using ANOVA and Predicted R² metrics. For optimization, we apply Derringer-Suich desirability algorithms to navigate the competing response surfaces and locate a geometric mean maximum. Finally, we execute a brute-force grid evaluation across thousands of multidimensional vertices to establish the Proven Acceptable Range (PAR), outputting an ICH-aligned dossier via `reportlab`.

## 24. DEVELOPMENT RULES / ENGINEERING PRINCIPLES

1.  Scientific correctness > visual polish.
2.  Reproducibility via random seed control.
3.  No hidden synthetic data presented as real empirical evidence.
4.  No stale model usage; data mutations strictly invalidate historical regressions.
5.  Zero extrapolation beyond the investigated DOE bounds.
6.  Use established scientific libraries (SciPy, Statsmodels, Pandas).
7.  Statistical logic is completely decoupled from FastAPI route handlers.
8.  Current-state reporting only; historical data must not contaminate final dossiers.
9.  Explicit semantic distinction between simulated and experimental confirmation.
10. Pass backend tests (`pytest`) before declaring any phase complete.

## 25. FUTURE ROADMAP

*(Not currently implemented)*
*   PostgreSQL migration for production concurrent environments.
*   21 CFR Part 11 Audit Trails & Electronic Signatures.
*   User Roles and Access Management.
*   Direct integration with Chromatography Data Systems (CDS).
*   Windows EXE packaging for standalone offline lab deployments.
"""

with open("F:\\Developer Abhishek\\Website\\AQbD\\README.md", "w", encoding="utf-8") as f:
    f.write(readme_content)

print("README.md written successfully.")
