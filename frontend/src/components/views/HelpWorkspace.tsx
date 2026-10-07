import React from 'react';

export default function HelpWorkspace() {
  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Header */}
      <div className="flex-none bg-[#EFEFEF] border-b border-[#C0C0C0] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="font-bold text-[#003366] text-[14px]">AQbD Studio V1.0 — Help & Documentation</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 bg-white">
        <div className="max-w-3xl mx-auto flex flex-col gap-8 text-gray-800 text-[13px] leading-relaxed">
          
          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">1. Getting Started</h2>
            <p className="mb-2">
              AQbD Studio is a browser-based scientific Response Surface Methodology (RSM) and statistical analysis application. 
              It provides a desktop scientific-software experience directly in your browser.
            </p>
            <p>
              To get started, create a new project, design an experiment, record your responses, and perform a statistical analysis.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">2. Creating a Project</h2>
            <p className="mb-2">
              By default, an untitled project is loaded when you launch the application. 
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use <strong>File &rarr; New Project</strong> to start a blank project.</li>
              <li>Use <strong>File &rarr; Save As...</strong> to give your project a name and save it to the database.</li>
              <li>Use <strong>File &rarr; Open Project...</strong> to retrieve a previously saved project.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">3. Creating a CCD</h2>
            <p className="mb-2">
              Central Composite Designs (CCD) are ideal for fitting a quadratic surface and identifying optimal responses.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Select <strong>Design &rarr; Response Surface &rarr; Randomized &rarr; Central Composite</strong>.</li>
              <li>Define the number of numeric factors (typically 2 to 4).</li>
              <li>Set your Low and High actual limits for each factor.</li>
              <li>Provide names and units for your experimental responses.</li>
              <li>Click <strong>Generate Design</strong> to populate your Design Table.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">4. Creating a Box-Behnken Design</h2>
            <p className="mb-2">
              Box-Behnken Designs (BBD) are 3-level designs that require fewer runs than CCD and avoid extreme axial points.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Select <strong>Design &rarr; Response Surface &rarr; Randomized &rarr; Box-Behnken</strong>.</li>
              <li>Define 3 or 4 continuous factors with their ranges.</li>
              <li>Provide response configurations and generate the design table.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">5. Understanding the Design Table</h2>
            <p className="mb-2">
              The Design Table organizes your experimental runs. It shows the factor combinations you need to test.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Std:</strong> Standard mathematical order of the design points.</li>
              <li><strong>Run:</strong> Randomized execution order to mitigate lurking variables.</li>
              <li><strong>Display Mode:</strong> Toggle between Actual units and Coded (-1 to +1) values using the toolbar selector.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">6. Entering Experimental Responses</h2>
            <p className="mb-2">
              After executing your physical experiments, enter the measured results directly into the Design Table response columns.
              Analysis cannot proceed until a response has valid data for all runs.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">7. Starting Analysis</h2>
            <p className="mb-2">To start an analysis:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open the <strong>Analysis</strong> workspace from the Project Tree.</li>
              <li>Confirm the response data are populated in the Design Table.</li>
              <li>Select the target response and the appropriate model configuration (e.g., Quadratic).</li>
              <li>Click <strong>Start Analysis</strong>.</li>
              <li>Review the ANOVA, Fit Statistics, Diagnostics, and Model Graphs.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">8. Model Selection</h2>
            <p className="mb-2">
              V1.0 currently defaults to generating a <strong>Quadratic</strong> model, which is the primary model for Response Surface Methodology (RSM) designed to capture curvature.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">9. Understanding ANOVA</h2>
            <p className="mb-2">
              Analysis of Variance (ANOVA) is used to evaluate model and term significance. 
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>p-value &lt; 0.05:</strong> Term is typically considered statistically significant.</li>
              <li><strong>F-value:</strong> Ratio of model variance to error variance. Larger is generally better.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">10. Fit Statistics</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>R²:</strong> How much of the observed response variation is explained by the fitted model.</li>
              <li><strong>Adjusted R²:</strong> R² adjusted for model complexity. Penalizes unnecessary terms.</li>
              <li><strong>Predicted R²:</strong> How well the model is expected to predict observations.</li>
              <li><strong>C.V. %:</strong> Coefficient of variation expressed as a percentage. Lower implies higher reproducibility.</li>
              <li><strong>Adequate Precision:</strong> Signal-to-noise style measure used to evaluate model prediction signal relative to noise. A ratio greater than 4 indicates an adequate signal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">11. Lack of Fit</h2>
            <p className="mb-2">
              Used when replicated observations (e.g., center points) provide an estimate of pure error. A non-significant Lack of Fit (p &gt; 0.05) is desirable, indicating the model fits the data adequately.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">12. Model Equations</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Coded Equation:</strong> Useful for identifying the relative impact of factors because coefficients are scaled.</li>
              <li><strong>Actual Equation:</strong> Useful for making real-world predictions using actual factor units.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">13. Diagnostics</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Normal Probability Plot:</strong> Checks the assumption that residuals are normally distributed (points should form a straight line).</li>
              <li><strong>Residual vs Predicted:</strong> Checks for constant variance (points should scatter randomly without a funnel shape).</li>
              <li><strong>Predicted vs Actual:</strong> Shows how closely predicted values match the actual observed values. Points should lie near the 45-degree identity line.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">14. Model Graphs</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Perturbation:</strong> Shows how the response changes as each factor moves from the reference point while holding all other factors constant.</li>
              <li><strong>One Factor:</strong> Shows the predicted response varying across a single factor's range.</li>
              <li><strong>Interaction:</strong> Displays the effect of two factors changing simultaneously. Parallel lines indicate weak interaction; crossing lines indicate strong interaction.</li>
              <li><strong>Contour:</strong> A 2D topographical map of the predicted surface.</li>
              <li><strong>3D Surface:</strong> A 3D isometric view of the predicted response surface showing actual design points hovering at their observed Z-heights.</li>
              <li><strong>Predicted vs Actual:</strong> (Replicated from Diagnostics) Checks prediction accuracy against experimental observations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">15. Reading Graphs</h2>
            <p className="mb-2">
              Graphs dynamically update based on the Right-Side settings tool. 
              If the model has more than 2 factors, any factors not mapped to X or Y axes are "held" at the values specified by the sliders.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">16. Coded vs Actual Factors</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Coded Factors:</strong> Normalized factor representation used by RSM models (typically -1 for Low, 0 for Center, +1 for High).</li>
              <li><strong>Actual Factors:</strong> Original physical factor units (e.g., °C, pH, hours).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">17. Project Management</h2>
            <p className="mb-2">
              AQbD Studio uses a robust REST API backend.
              To preserve your work across sessions, you must save your project to the database using <strong>File &rarr; Save As...</strong> or <strong>File &rarr; Save</strong>. 
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">18. Full Screen Mode</h2>
            <p className="mb-2">
              Click the "Full Screen" button in the top right of the application to expand the workspace and remove browser chrome, providing a true desktop application feel.
            </p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">19. Common Problems / Troubleshooting</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Analysis does not start:</strong> Ensure you have clicked "Generate Design" and fully populated all rows for the chosen Response in the Design Table.</li>
              <li><strong>Graph unavailable:</strong> Model graphs require a successfully fitted model. Run the Analysis first.</li>
              <li><strong>Project not saved:</strong> "Untitled" projects live only in temporary browser memory until you explicitly select "Save As...".</li>
              <li><strong>Docker container status:</strong> Use <code>docker compose ps</code> and <code>docker compose logs</code> to troubleshoot backend or database connection issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">20. V1.0 Limitations</h2>
            <p className="mb-2">AQbD Studio V1.0 is the core foundation. The following are explicitly excluded in this baseline version:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Authentication / Role-Based Access Control (RBAC)</li>
              <li>Formal audit trails and electronic signatures</li>
              <li>Mixture, Split Plot, and Optimal Custom Designs</li>
              <li>Blocking and Interference Studies</li>
              <li>Multi-response Optimization module</li>
              <li>Enterprise deployment scaling</li>
            </ul>
            <p className="mt-2 italic text-gray-500">Note: AQbD Studio V1.0 is a research/development scientific software project and is not presented as a validated regulatory system.</p>
          </section>

          <section>
            <h2 className="text-[#0055A4] text-[18px] font-bold border-b border-[#0055A4] pb-1 mb-3">21. Future Roadmap</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>V1.0</strong> — RSM Core (Current)</li>
              <li><strong>V2</strong> — Advanced RSM, Diagnostics, Optimization, and Additional Workflows</li>
              <li><strong>V3</strong> — Full AQbD Workflow (Risk Assessment, CQA, CMP)</li>
              <li><strong>V4</strong> — Production / Enterprise (Compliance, E-Signatures)</li>
            </ul>
          </section>

          <div className="h-8"></div>
        </div>
      </div>
    </div>
  );
}
