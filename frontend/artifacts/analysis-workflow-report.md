# AQbD Studio — Analysis Workflow (Configure → Model → ANOVA)

## 1. Response Readiness Implementation
- The sidebar dynamically evaluates response completeness for the active design.
- The `Analysis` node checks if all numeric runs exist and are finite for at least one response.
- **Unavailable state:** Displays `Analysis 🔒` and disables the node until sufficient data is entered.
- **Available state:** Updates to `Analysis ✓` instantly as soon as response values are fully populated in the Design Table.

## 2. Analysis Workspace UI
- Switched `AnalysisWorkspace` into a self-contained container representing the dedicated desktop analysis experience.
- Uses horizontal, desktop-style tabs mapped exactly as requested: `[ Configure ] [ Model ] [ ANOVA ] [ Diagnostics ] [ Model Graphs ]`.
- Placeholder tabs (Diagnostics, Model Graphs) exist structurally but are disabled to adhere strictly to V1.3 requirements.
- Uses a compact, dense scientific aesthetic without huge SaaS-style cards.

## 3. Configure Screen Implementation
- Initial tab upon opening the `Analysis` workspace is `Configure`.
- Includes a strict **Response Selection** dropdown, gracefully identifying and disabling any responses that are "Incomplete".
- **Regression Selection:** "Linear Regression" (only option).
- **Transformation:** "No Transform" (only option).
- Includes the `Start Analysis` button, fully locked down to prevent execution on stale or incomplete states.

## 4. Start Analysis Implementation
- Button performs pre-flight validation on the selected response.
- Automatically compiles `codedData` matrix and matching array of `y` experimental response values.
- Engages the backend-agnostic statistical engine `createModelMatrix` and `analyzeModel`.
- Overrides `project.data.designs[activeDesignId].analyses = { ... }` with the timestamped mathematical fit output.
- Smoothly transitions the UI from `Configure` over to the `Model` tab upon calculation completion.

## 5. Model Screen Implementation
- Programmatically renders the generated terms list calculated by `createModelMatrix`.
- Displays `Process Order: Quadratic` explicitly as the top-level selector.
- Correctly parses the `TermMetadata` object properties and renders clean term labels (e.g. `Intercept`, `A`, `AB`, `A²`).
- Implements visual indicator states (e.g., `✓ Included`) to map the structural inclusion rules dynamically against the stat engine.

## 6. ANOVA & Statistics Implementation
- Bound purely to the validated backend calculations; absolutely **zero fake values** are injected into the UI.
- **ANOVA Table:** Fully integrated `Source, SS, df, MS, F-value, p-value` mappings across Model, Residual, Lack of Fit, Pure Error, and Total rows.
- **Fit Statistics:** R², Adjusted R², Predicted R², C.V. %, and Adequate Precision display robust values derived from the engine.
- **Coefficients:** Dynamically tabulates calculated parameter estimates.

## 7. Stale-Analysis Handling
- Modified `DesignTable.tsx` to automatically push a `runsModifiedAt` timestamp down to the active design dictionary upon any numeric edit.
- `AnalysisWorkspace` instantly detects if `design.runsModifiedAt > analysis.timestamp`.
- Automatically raises a "Stale Analysis" warning banner requesting explicit user refit if underlying tabular data fundamentally changes.

## 8. Persistence 
- Statistical fit objects remain safely scoped per-response inside `project.data.designs[activeDesignId].analyses[responseId]`.
- Withstands browser refreshes, duplicating, and saving workflows without accidental recalculation or memory leakage.

## 9. Build Result & Testing
- CCD & BBD logic workflows remain perfectly decoupled and robust.
- The `tsc && vite build` processes returned a success exit code, validating all strict typing around the analysis interfaces.
- The workspace tree is safely patched against malformed syntax edge cases.

## 10. Remaining Limitations
- Coded Equation and Actual Equation representations inside ANOVA are pending structural equation-parser integration (V1.4+).
- Diagnostics, Optimization, and Model Graphs tabs exist but are explicitly disabled for future implementation.
