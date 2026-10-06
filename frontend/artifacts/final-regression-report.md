# AQbD Studio — Final Workspace Navigation & Regression Report

## 1. Sidebar Behavior Implemented
- Successfully integrated a strict `design-created` event that fires *only* upon a successful design generation and save.
- Upon creation, `ProjectTree` dynamically updates its local `expanded` state mapping to instantly collapse `std_designs` (Standard Designs) and explicitly expand `project_data` and `project_designs` (Project > Designs).
- Users can manually re-expand Standard Designs at any point by clicking its arrow without losing their current active design context.

## 2. Active Design Behavior
- The `handleCreate` functions inside `CCDWizard` and `BBDWizard` now mutate `activeDesignId` to the newly generated `designId`.
- The `StatusBar` was refactored to read directly from `project.data.designs[activeDesignId]` so it actively tracks and accurately reflects the UI: `Project: <name> | Design: <Design Name> | Runs: <count>`.

## 3. Project Tree Behavior
- Standard Designs correctly hides its sub-tree to declutter the sidebar upon design generation.
- Default names are automatically injected into the node generation: `Central Composite Design 1`, `Box-Behnken Design 2`, etc., calculated cleanly based on `Object.keys(project.data.designs).length`.
- `ProjectTree` gracefully falls back to the design type + response name if the `name` field doesn't explicitly exist (handling legacy saved designs natively).

## 4. CCD Regression Result
- **Passed.** Wizard steps properly block on invalid configurations.
- Execution calculates factorial, center, and axial bounds successfully.
- No duplicate designs are created; all mathematical calculations map correctly to the exact number of defined factors and responses.

## 5. BBD Regression Result
- **Passed.** 2k(k-1) formula executes flawlessly without axial extensions.
- Factor step bounds validate accurately.

## 6. Design Table Result
- **Passed.** Reading `runs` accurately from the active design.
- The `null` index bug was patched with strict `if (activeDesignId)` guards across the `handleEditSave` mutating functions.
- Toggles (Coded/Actual) preserve the mathematical models natively without overwriting the actual saved values.

## 7. Persistence Result
- **Passed.** Handled deep saves safely without breaking. 
- Refreshes explicitly target `project.data.designs`, restoring the exact state and layout (runs, standard order, user-inputted response values) without regenerating anything.
- The `ProjectTree` `useEffect` reads the incoming `project.id` string and dynamically pre-collapses `std_designs` upon browser refresh *if* the loaded project already contains active designs. 

## 8. Project Management Result
- **Passed.** Standard new/open/save modal lifecycle remains unimpacted. Legacy projects with a singular `design` object are accurately upgraded in memory by the Context Provider.

## 9. Tests Passed
- Manual workflow validation confirms precise `AppShell` modal listener cleanup (`window.removeEventListener`), confirming zero duplicate wizard instances.
- UI state properly encapsulates on 'Cancel', leaving absolutely no trailing data or ghost properties inside `ProjectContext`.

## 10. Build Result
- **Passed.** TypeScript compiler `tsc` passed with 0 errors across the entire codebase (`strict` and `noUnusedLocals` active).
- Vite successfully emitted the production build artifact cleanly.

## 11. Bugs Fixed
- Patched a critical silent `TypeError: Type 'null' cannot be used as an index type` that occurred when modifying responses in the `DesignTable` without a rigorously verified `activeDesignId`.
- Replaced the implicit component re-mounting behavior in the sidebar with explicit React state transition bounds.
- Eliminated all trailing `project.data.design` loose objects from previous UI integrations (like `ModelSelection`), aligning 100% of the UI to the global multi-design schema.

## 12. Remaining Limitations
- While individual DOE modules are uniquely encapsulated, the overall `project` payload continues to expand. Future V2 optimizations should slice saves using a database schema rather than stringifying an increasingly massive `data` JSON blob.
- The tree navigation supports unique names, but right-clicking to "Rename" an individual Design inside the Tree has not yet been bound to a user-facing action prompt.
