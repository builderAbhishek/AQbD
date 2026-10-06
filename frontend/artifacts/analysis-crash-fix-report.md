# AQbD Studio — V1.3/V1.4 Analysis Crash Root Cause & Fix Report
**Status:** ✅ RESOLVED & VERIFIED  
**Date:** 2026-10-06  

---

## 1. Exact Root Cause
When the user clicked **"Start Analysis"** in `ConfigureAnalysis.tsx`, the statistical engine calculated the model via `analyzeModel()`, which returned `{ fitted: FittedModel, anova, lackOfFit, diagnostics }`. 

`ConfigureAnalysis.tsx` then assembled the analysis object by spreading `...analysisResult` directly:
```typescript
const fullAnalysis = {
  ...analysisResult,
  responseId: activeResponseId,
  modelType: 'Quadratic' as const,
  factors: design.config.factors,
  timestamp: new Date().toISOString()
};
```
Because the statistical output object named the property `fitted`, the resulting stored analysis object had `fullAnalysis.fitted`, but **`fullAnalysis.fittedModel` was undefined**.

The downstream `ModelTab.tsx` component, however, destructured:
```typescript
const { fittedModel } = analysis;
```
And immediately evaluated:
```typescript
Process Order: {fittedModel.modelType}
```
Because `fittedModel` was `undefined`, accessing `fittedModel.modelType` resulted in the fatal unhandled error:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'modelType') at ModelTab.tsx:19
```
This unhandled exception during React's render phase blanked out the entire web application.

---

## 2. Which Object / Property Was Undefined
- **Undefined Property:** `analysis.fittedModel`
- **Sub-property Attempted to Read:** `analysis.fittedModel.modelType` and `analysis.fittedModel.terms.map(...)`

---

## 3. Why Start Analysis Produced the Malformed / Partial State
1. **Property Name Asymmetry:** In `statistics.ts`, the return signature of `analyzeModel` returned `{ fitted, anova, lackOfFit, diagnostics }`, while the canonical interface `RSMAnalysis` in `types.ts` defined the field as `fittedModel: FittedModel`.
2. **Missing Validation Guard:** `ConfigureAnalysis.tsx` did not validate that the assembled `fullAnalysis` object matched the full `RSMAnalysis` schema before saving it to `project.data.designs[activeDesignId].analyses[activeResponseId]`.
3. **Missing Defensive Safeguards:** Neither `ModelTab`, `ANOVA`, nor `DiagnosticsTab` checked whether `analysis` or `fittedModel` was defined before evaluating nested properties.

---

## 4. Fix Applied
### A. Statistical Engine (`statistics.ts` & `types.ts`)
- In `statistics.ts` (`analyzeModel`), updated the return value to provide both `fittedModel` and `fitted`:
  ```typescript
  return { 
    fitted, 
    fittedModel: fitted, 
    anova, 
    lackOfFit: lofResult, 
    diagnostics 
  };
  ```
- In `types.ts`, ensured `RSMAnalysis` supports both `fittedModel: FittedModel` and optional compatibility alias `fitted?: FittedModel`.

### B. Analysis Result Construction & Schema Enforcement (`ConfigureAnalysis.tsx`)
- In `ConfigureAnalysis.tsx`, explicitly assigned both `fittedModel` and `fitted`:
  ```typescript
  const fittedModel = analysisResult.fittedModel || analysisResult.fitted;
  const fullAnalysis: RSMAnalysis = {
    responseId: activeResponseId,
    modelType: 'Quadratic',
    factors: design.config.factors,
    fittedModel: fittedModel,
    fitted: fittedModel,
    anova: analysisResult.anova,
    lackOfFit: analysisResult.lackOfFit,
    diagnostics: analysisResult.diagnostics,
    timestamp: new Date().toISOString()
  };
  ```

### C. Validation Before Committing (`validation.ts`)
- Created `validateAnalysisResult(analysis)` which checks:
  1. `analysis` is a non-null object.
  2. `responseId` and `modelType` exist and are valid.
  3. `fittedModel` exists with numeric coefficients and valid term metadata.
  4. Coefficients count matches terms count.
  5. Fit statistics (`n`, `p`, `SSE`, `SST`) are valid numbers.
  6. ANOVA table contains at minimum `Model` and `Total` rows.
  7. Diagnostics array exists, matches observation count `n`, and contains finite predicted values and residuals.
- `ConfigureAnalysis.tsx` calls `validateAnalysisResult(fullAnalysis)` **before** mutating `design.analyses` or saving the project. If validation fails, an error is raised and state is never corrupted.

---

## 5. ModelTab Safety Guard
`ModelTab.tsx` was hardened with defensive checks:
- Safely extracts `const fittedModel = analysis?.fittedModel || analysis?.fitted;`.
- If `!analysis || !fittedModel`, renders a clean desktop scientific empty-state box:
  ```
  Model
  No fitted analysis is available.
  Run Start Analysis to generate the model.
  ```
- Displays:
  - **Process Order:** `fittedModel.modelType || 'Quadratic'`
  - **Fitted Terms Table:** `Term`, `Type`, `Coefficient` (formatted), and `Status: Included`.
- Never crashes under any state transition or malformed object.

---

## 6. AnalysisWorkspace State Handling & ANOVA / Diagnostics Defensiveness
- `ANOVA.tsx` and `DiagnosticsTab.tsx` were similarly safeguarded: they safely fallback to clean empty states if analysis is not yet fitted.
- `AnalysisWorkspace.tsx` computes `hasFittedAnalysis = Boolean(analysis && (analysis.fittedModel || analysis.fitted))`.
- Tab navigation dynamically locks `ANOVA` and `Diagnostics` until a valid model is fitted, with clear lock symbols (`Diagnostics 🔒` / `Diagnostics ✓`).
- When stale (`runsModifiedAt > timestamp`), a top warning banner is displayed with `[ Refit Analysis ]`.
- In `DesignTable.tsx`, edits to response cells now update `runsModifiedAt = new Date().toISOString()`, guaranteeing stale detection works reliably.

---

## 7. Error Boundary (`AnalysisErrorBoundary.tsx`)
- Implemented a specialized React error boundary (`AnalysisErrorBoundary.tsx`) wrapping the active view inside `AnalysisWorkspace`.
- If an unhandled exception occurs in any child component, the application does not blank out; instead, it renders an **"Analysis View Error"** dialogue with technical details and a **[ Retry ]** button that safely resets the tab to `Configure`.

---

## 8. Atomic State Update & Pre-Flight Validation
In `ConfigureAnalysis.tsx`:
1. `isFitting` state disables the button and displays a progress spinner.
2. Validates that the design has factors and the selected response exists.
3. Checks every single run: non-numeric, null, or undefined values trigger an exact error (e.g., `Run 4 has missing or non-numeric response data for 'Assay'`).
4. Checks degrees of freedom: verifies that the number of runs $N \ge p$ (parameters required for Quadratic model: $p = 1 + 2k + k(k-1)/2$).
5. Fits model, verifies mathematical results via `validateAnalysisResult()`.
6. Only then stores in `design.analyses[activeResponseId]` and calls `await saveProject()`.
7. Transitions to `Model` tab atomically.
8. If an error occurs, catches it, leaves tab as `Configure`, and opens a desktop scientific error dialog with `Reason: <actual message>` and `[ OK ]`.

---

## 9. Regression Test Suite
Created `frontend/src/lib/statistics/rsm/analysis_crash_regression.test.ts` covering:
1. `validateAnalysisResult` unit tests:
   - Rejection of null/undefined inputs.
   - Rejection of missing `modelType`.
   - Rejection of missing `fittedModel`.
   - Rejection of mismatched or empty `coefficients`.
2. Full CCD End-to-End Analysis Workflow:
   - 2-factor CCD (13 runs) generated with 5 center points.
   - Deterministic responses provided (Yield: 69.0% to 91.4%).
   - Model matrix constructed for Quadratic model (6 terms).
   - `analyzeModel` executed with raw runs.
   - Verified that `fittedModel` and `fitted` are both defined.
   - Verified $R^2 > 0.8$, ANOVA Model/Residual/Total/LOF/Pure Error rows, and 13 diagnostics records.
   - Verified that `validateAnalysisResult` passes.
3. `ModelTab` Defensive Rendering Tests:
   - Renders without throwing when `analysis: null` or `analysis: undefined`.
   - Renders without throwing when `analysis.fittedModel` is missing (reproducing the exact reported bug).
   - Renders process order, all terms, and coefficients when valid analysis is supplied.

**Test Results:**
```
✓ src/lib/design/bbd.test.ts (5 tests)
✓ src/lib/design/ccd.test.ts (5 tests)
✓ src/lib/statistics/rsm/rsm.test.ts (6 tests)
✓ src/lib/statistics/rsm/analysis_crash_regression.test.ts (8 tests)

Test Files  4 passed (4)
     Tests  24 passed (24)
```

---

## 10. Persistence & Build Verification
- **Production Build:** `docker-compose exec frontend npm run build` (`tsc && vite build`) completed with exit code 0 (`dist/assets/index-Bw6KIU5I.js` 443.80 kB).
- **Runtime Server:** `http://localhost:3000` responds with `HTTP 200 OK`.
- **Browser State Lifecycle:** On page refresh, projects load with existing `analyses[responseId]`, which now correctly contains `fittedModel`, preventing reload crashes.
