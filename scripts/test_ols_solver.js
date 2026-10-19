// Test standalone OLS polynomial solver against frontend statistics
const http = require('http');

function solveLinearSystem(A, b) {
  const n = A.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    // Swap rows
    const tmp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = tmp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error('Singular matrix in OLS');
    }

    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map(row => row[n]);
}

http.get('http://localhost:3001/api/v1/projects', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const d = projects[0].data.designs[Object.keys(projects[0].data.designs)[0]];
    const runs = d.runs;
    const factors = d.config.factors;

    // Build X matrix for Quadratic model
    // Terms: Intercept, f1, f2, f3, f1*f2, f1*f3, f2*f3, f1^2, f2^2, f3^2
    const X = [];
    runs.forEach(r => {
      const x1 = r.codedValues.f1;
      const x2 = r.codedValues.f2;
      const x3 = r.codedValues[factors[2].id];
      X.push([
        1,
        x1,
        x2,
        x3,
        x1 * x2,
        x1 * x3,
        x2 * x3,
        x1 * x1,
        x2 * x2,
        x3 * x3
      ]);
    });

    const n = X.length;
    const p = X[0].length;

    // Compute X^T * X and X^T * Y
    function fit(respId) {
      const y = runs.map(r => r.responses[respId]);
      const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
      const XtY = new Array(p).fill(0);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < p; j++) {
          XtY[j] += X[i][j] * y[i];
          for (let k = 0; k < p; k++) {
            XtX[j][k] += X[i][j] * X[i][k];
          }
        }
      }

      return solveLinearSystem(XtX, XtY);
    }

    ['r1', 'r1792184612732', 'r1792184617086'].forEach(rId => {
      const beta = fit(rId);
      const frontendBeta = d.analyses[rId].fittedModel.coefficients;
      console.log('Response ' + rId + ':');
      console.log('  Calculated Beta:', beta.map(v => v.toFixed(6)));
      console.log('  Frontend   Beta:', frontendBeta.map(v => v.toFixed(6)));
      let maxDiff = 0;
      for (let i = 0; i < beta.length; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(beta[i] - frontendBeta[i]));
      }
      console.log('  Max diff:', maxDiff);
    });
  });
});
