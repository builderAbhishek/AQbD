# AQbD Studio V1.0

AQbD Studio is a browser-based scientific Response Surface Methodology (RSM) and statistical analysis application designed with a desktop scientific-software experience.

**Note:** Browser-based technology with a desktop scientific application-style interface.

## 1. Overview
AQbD Studio V1.0 allows users to create statistical design of experiments (DOE), specifically focusing on Response Surface Methodology (RSM). Users can configure Central Composite or Box-Behnken designs, record their experimental observations, and perform robust statistical modeling including ANOVA, diagnostic evaluations, and interactive model graphs.

## 2. V1.0 Features
- **Project Management:** Create, Open, Save, Save As, Duplicate, Archive, and Delete projects.
- **Response Surface Designs:** Central Composite Design (CCD) and Box-Behnken Design (BBD).
- **Statistical Analysis:** Automatic model matrix generation, Linear, 2FI, and Quadratic regression fitting.
- **Diagnostics:** Normal Probability Plot, Residual vs Predicted, Predicted vs Actual.
- **Model Graphs:** Perturbation, One Factor, Interaction, Contour, 3D Surface, Predicted vs Actual.

## 3. Response Surface Designs
- **Central Composite Design (CCD):** Ideal for fitting a quadratic surface. Supports alpha levels (axial points) for circumscribed designs.
- **Box-Behnken Design (BBD):** 3-level designs that require fewer runs and avoid extreme axial points.
- **Features:** Randomized run order, coded (-1, 0, +1) and actual factor levels, interactive design table.

## 4. Statistical Analysis
- **Models:** Fit Linear, Two-Factor Interaction (2FI), or Quadratic models.
- **ANOVA & Fit Statistics:** Generates comprehensive ANOVA tables with Sum of Squares, degrees of freedom, Mean Square, F-value, and p-value.
- **Quality Metrics:** R², Adjusted R², Predicted R², Coefficient of Variation (C.V. %), Adequate Precision, and Lack of Fit.
- **Equations:** Provides prediction equations in both coded and actual factor units.

## 5. Diagnostics
- **Normal Probability Plot:** Verify residual normality.
- **Residual vs Predicted:** Verify constant variance assumptions.
- **Predicted vs Actual:** Check raw prediction accuracy.

## 6. Model Graphs
- **Perturbation:** Compare individual factor sensitivities from a reference point.
- **One Factor:** 2D curve of the predicted response varying across a single factor's range.
- **Interaction:** Evaluate the combined effect of two factors.
- **Contour:** 2D continuous prediction topographical map.
- **3D Surface:** 3D isometric representation of the response surface with real observed data points hovering at their exact Z-heights.
- **Predicted vs Actual:** Visual correlation of model fit.

## 7. Project Workflow
1. **Dashboard** &rarr; **New Project**
2. **Response Surface Design** &rarr; **CCD / BBD**
3. **Design Table** &rarr; **Enter Experimental Results**
4. **Analysis** &rarr; **Diagnostics** &rarr; **Model Graphs**

## 8. Desktop-style UI
The application runs in a modern web browser but intentionally adopts a scientific desktop application workflow. It eschews typical SaaS paradigms in favor of:
- Menu bar and toolbar operations
- Project Explorer tree view
- Tabbed analysis workspace
- Scientific tables and compact inputs
- Graph workspace with comprehensive right-side configuration panels
- Fullscreen mode

## 9. Technology Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Vite, HTML5 Canvas (for 3D Surface), Recharts (for standard 2D plots).
- **Backend:** Node.js, Express, TypeScript, SQLite, Prisma ORM.

## 10. Project Structure
```text
AQbD-V1/
├── backend/          # Node.js + Express API, Prisma schema, SQLite DB
├── frontend/         # React frontend, UI components, statistical algorithms
├── docker-compose.yml
├── .env.example
└── README.md
```

## 11. Running Locally (Docker)
The easiest way to run AQbD Studio is via Docker Compose:

```bash
git clone https://github.com/builderAbhishek/AQbD.git
cd AQbD
cp .env.example .env
docker compose up --build -d
```
Access the application by navigating to `http://localhost:3000` (or the port defined in your `.env`).

## 12. Docker Commands
- `docker compose up --build -d` : Build and run the containers in the background.
- `docker compose up -d` : Run the containers.
- `docker compose down` : Stop and remove the containers.
- `docker compose logs` : View application logs.
- `docker compose ps` : List running containers.

## 13. Testing / Building
To build the frontend manually for production:
```bash
cd frontend
npm install
npm run build
```

## 14. Scientific Calculation Notes
Statistical calculations (regression, ANOVA, R² metrics) are generated dynamically by the application's internal engine using matrix algebra. Graph visualizations strictly use identical model predictions passing through the same predictive engine rather than fabricated or disjointed values.

## 15. Limitations
AQbD Studio V1.0 is the core foundation. The following are explicitly excluded in this baseline version:
- Authentication / Role-Based Access Control (RBAC)
- Formal audit trails and electronic signatures
- Mixture, Split Plot, and Optimal Custom Designs
- Blocking and Interference Studies
- Multi-response Optimization module
- Enterprise deployment scaling

## 16. Roadmap
- **V1.0** — RSM Core
- **V2** — Advanced RSM / diagnostics / additional workflows
- **V3** — AQbD workflow
- **V4** — Production / enterprise

## 17. Disclaimer
AQbD Studio V1.0 is a research/development scientific software project and is not presented as a validated regulatory system or commercial equivalent.

## 18. License
Licensing is to be determined (currently unspecified).

## 19. Author / Organization
**Alag Innovative Solutions**  
*AQbD Studio V1.0*
