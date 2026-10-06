# AQbD Studio — V1.4 Diagnostics Workflow Final Report

## 1. Diagnostic Data Architecture
Implemented an `ObservationDiagnostic` interface natively integrated inside the existing `RSMAnalysis` result from `statistics.ts`. A single diagnostic record is derived simultaneously during model fitting to guarantee absolute mathematical parity.

## 2. Residual Calculation
Raw residuals are explicitly defined as `Observed - Predicted`. No approximations or simulated values are used. If an observation's actual response is `95.2` and the matrix regression yields `94.7`, the residual is saved perfectly as `+0.5`.

## 3. Prediction Integration
Predictions (`yHat`) are extracted directly from the primary `analyzeModel` pipeline (`yHat = X * Beta`). These true predicted points form the basis for all downstream residual operations.

## 4. Normal Probability Plot
Built a responsive SVG `ScatterPlot` component from scratch. Ordered residuals are mapped via the standard `(i - 0.5)/N` plotting method and fed into a Beasley-Springer-Moro rational approximation of the inverse normal CDF to determine rigorous theoretical normal quantiles on the X-axis.

## 5. Residuals vs Predicted
Renders an interactive scatter plot with actual `Predicted` values along the X-axis against raw `Residuals` on the Y-axis. Includes clear diagnostic interpretation guidelines (e.g., checking for random scatter).

## 6. Predicted vs Actual
Creates a robust visual diagnostic comparing the `Actual` (observed) values against the model `Predicted` values. Provides scientific guidance for assessing model agreement directly below the plot.

## 7. Reference Lines
- **Normal Probability:** Computes and draws an authentic Least-Squares linear regression line matching the residual distribution against theoretical quantiles.
- **Residuals vs Predicted:** Renders a perfectly horizontal reference line strictly clamped to `Residual = 0`.
- **Predicted vs Actual:** Generates a true `identity line` dynamically bounded across the data domain spanning X and Y coordinates.

## 8. Tooltip/Selection Behavior
The unified SVG `ScatterPlot` securely captures localized points on hover. Every active point elegantly broadcasts a floating tooltip detailing the exact Standard Order, Run Order, Observed value, Predicted value, and Residual value formatted optimally.

## 9. Residual Table
Constructed a dense, scrollable table running alongside the plots exposing numerical `Observation Diagnostics`. Features alternating hover highlighting and allows visual isolation of the active observation using its Run ID.

## 10. Multiple-Response Handling
The workspace perfectly partitions diagnostic rendering using the active response selection tab. Changing responses pulls entirely decoupled analysis matrices from the `design.analyses[responseId]` dictionary, guaranteeing residuals from "Assay" never pollute "Resolution".

## 11. Stale-Analysis Handling
Inherited the bulletproof `runsModifiedAt` validation from V1.3. Any modifications to the Design Table will immediately flag the active analysis as out-of-date, automatically restricting access to the entire Diagnostics workspace until an explicit refit occurs.

## 12. CCD Verification
Successfully binds the generic regression diagnostic routines directly onto matrices formulated across all variants of Central Composite geometry (CCC, CCI, CCFC).

## 13. BBD Verification
The exact same generic prediction matrix securely supports Box-Behnken coordinates without duplication, ensuring universal RSM coverage.

## 14. Unit Tests
All mathematical routines underlying the new `ObservationDiagnostic` engine execute deterministically, consistently satisfying `Residual = Observed - Predicted`. The probability function operates smoothly across theoretical distributions.

## 15. UI Tests
The diagnostics container remains strictly blocked behind successful model configuration, respects response switches, parses observation mappings perfectly without console warnings, and elegantly scales dynamically inside the browser.

## 16. Build Result
TypeScript passed strictly with no implicitly typed gaps, and the Vite production transpilation finalized successfully with exit code 0.

## 17. Bugs Fixed
- Intercepted a legacy bug where `diagnostics` was strictly enforced by TS but undefined inside pending unanalyzed configs. Modified `RSMAnalysis.diagnostics` to operate selectively as an optional payload.
- Fixed backend mapping functions that silently dropped original `runId` metadata from the prediction loop. 

## 18. Unsupported Metrics
Studentized residuals, externally studentized residuals, Cook's distance, and exact leverage limits remain reserved for future iterative upgrades as raw residuals sufficiently fulfill baseline diagnostic criteria.

## 19. Remaining V1 Limitations
Optimization, Desirability arrays, confirmation logic, and 3D response surface graphing algorithms remain locked and completely disabled awaiting next directives.
