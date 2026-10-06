import os
import sys

filepath = 'frontend/src/lib/statistics/rsm/statistics.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("AnovaRow, LackOfFitResult", "AnovaRow, LackOfFitResult, ObservationDiagnostic")

diagnostics_block = """  // Diagnostics
  const diagnostics: ObservationDiagnostic[] = [];
  let H_matrix: any = null;
  try {
    const XtX = XMat.transpose().mmul(XMat);
    const XtX_inv = solve(XtX, Matrix.eye(p));
    H_matrix = XMat.mmul(XtX_inv).mmul(XMat.transpose());
  } catch(e) {}

  for (let i = 0; i < n; i++) {
    diagnostics.push({
      runId: null,
      standardOrder: i + 1,
      runOrder: i + 1,
      observed: y[i],
      predicted: yHat[i],
      residual: y[i] - yHat[i],
      leverage: H_matrix ? H_matrix.get(i, i) : null
    });
  }

  return { fitted, anova, lackOfFit: lofResult, diagnostics };
}"""

content = content.replace("  return { fitted, anova, lackOfFit: lofResult };\n}", diagnostics_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated statistics.ts")
