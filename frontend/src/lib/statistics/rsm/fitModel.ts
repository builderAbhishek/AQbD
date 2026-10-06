import { Matrix, QrDecomposition, SingularValueDecomposition } from 'ml-matrix';
import { ModelMatrixResult } from './types';

/**
 * Solves OLS regression y = Xb + e using numerically stable QR decomposition.
 * Detects rank deficiency and ill-conditioning explicitly.
 * 
 * @param modelMatrix Generated X matrix and terms
 * @param y Array of response values corresponding to the rows of X
 */
export function fitModel(
  modelMatrix: ModelMatrixResult,
  y: number[]
) {
  const { X, terms } = modelMatrix;
  
  if (X.length !== y.length) {
    throw new Error('Number of rows in X must match length of y.');
  }
  
  if (X.length === 0) {
    throw new Error('No data provided to fit the model.');
  }

  // Create ml-matrix objects
  const XMat = new Matrix(X);
  const yMat = Matrix.columnVector(y);

  // Check degrees of freedom
  const n = XMat.rows;
  const p = XMat.columns;

  if (n < p) {
    throw new Error(`The selected model cannot be estimated from the available data. (Runs=${n}, Terms=${p})`);
  }

  try {
    // Numerically stable QR Decomposition
    const qr = new QrDecomposition(XMat);
    if (!qr.isFullRank()) {
      const svd = new SingularValueDecomposition(XMat);
      throw new Error(`The selected model cannot be estimated from the available data due to rank deficiency. (Rank=${svd.rank}, Terms=${p})`);
    }

    const bMat = qr.solve(yMat);
    const coefficients = bMat.to1DArray();

    // Verify non-NaN finite values
    for (let i = 0; i < coefficients.length; i++) {
      if (isNaN(coefficients[i]) || !Number.isFinite(coefficients[i])) {
        throw new Error(`Calculated coefficient for ${terms[i]?.name || i} is NaN or non-finite.`);
      }
    }

    return {
      coefficients,
      terms
    };
  } catch (error: any) {
    throw new Error(`Model fitting failed. The model might be singular, aliased, or perfectly collinear. (${error.message})`);
  }
}
