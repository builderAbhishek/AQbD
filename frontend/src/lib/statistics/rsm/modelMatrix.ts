import { ModelType, TermMetadata, ModelMatrixResult } from './types';

/**
 * Returns all potential candidate terms up to quadratic order for given factor IDs.
 */
export function getAllCandidateTerms(factorIds: string[]): TermMetadata[] {
  const terms: TermMetadata[] = [];

  // 1. Intercept
  terms.push({
    name: 'Intercept',
    type: 'intercept',
    factors: [],
    isHierarchyEnforced: true
  });

  // 2. Linear terms
  for (const f of factorIds) {
    terms.push({
      name: f,
      type: 'linear',
      factors: [f],
      isHierarchyEnforced: true
    });
  }

  // 3. Two-factor interactions (2FI)
  for (let i = 0; i < factorIds.length - 1; i++) {
    for (let j = i + 1; j < factorIds.length; j++) {
      terms.push({
        name: `${factorIds[i]}*${factorIds[j]}`,
        type: 'interaction',
        factors: [factorIds[i], factorIds[j]],
        isHierarchyEnforced: false
      });
    }
  }

  // 4. Quadratic terms
  for (const f of factorIds) {
    terms.push({
      name: `${f}^2`,
      type: 'quadratic',
      factors: [f],
      isHierarchyEnforced: false
    });
  }

  return terms;
}

/**
 * Enforces scientific model hierarchy.
 */
export function enforceModelHierarchy(
  selectedTermNames: string[],
  allCandidates: TermMetadata[]
): TermMetadata[] {
  const namesSet = new Set<string>(selectedTermNames);
  namesSet.add('Intercept'); // Always required

  for (const termName of selectedTermNames) {
    const candidate = allCandidates.find(c => c.name === termName);
    if (candidate) {
      for (const factorId of candidate.factors) {
        namesSet.add(factorId);
      }
    }
  }
  return allCandidates.filter(c => namesSet.has(c.name));
}

/**
 * Creates a model matrix X and term metadata for the given coded data and model type or custom terms.
 */
export function createModelMatrix(
  codedData: Record<string, number>[],
  factorIds: string[],
  modelType: ModelType | 'Mean' | 'Cubic',
  customTerms?: TermMetadata[]
): ModelMatrixResult {
  let terms: TermMetadata[];

  if (customTerms && customTerms.length > 0) {
    terms = customTerms;
  } else {
    terms = [];
    
    // 1. Intercept
    terms.push({
      name: 'Intercept',
      type: 'intercept',
      factors: [],
      isHierarchyEnforced: true
    });

    if (modelType !== 'Mean') {
      // 2. Linear terms
      for (const f of factorIds) {
        terms.push({
          name: f,
          type: 'linear',
          factors: [f],
          isHierarchyEnforced: true
        });
      }

      // 3. Two-factor interactions (2FI)
      if (modelType === '2FI' || modelType === 'Quadratic' || modelType === 'Cubic') {
        for (let i = 0; i < factorIds.length - 1; i++) {
          for (let j = i + 1; j < factorIds.length; j++) {
            terms.push({
              name: `${factorIds[i]}*${factorIds[j]}`,
              type: 'interaction',
              factors: [factorIds[i], factorIds[j]],
              isHierarchyEnforced: false
            });
          }
        }
      }

      // 4. Quadratic terms
      if (modelType === 'Quadratic' || modelType === 'Cubic') {
        for (const f of factorIds) {
          terms.push({
            name: `${f}^2`,
            type: 'quadratic',
            factors: [f],
            isHierarchyEnforced: false
          });
        }
      }

      // 5. Cubic terms
      if (modelType === 'Cubic') {
        for (const f of factorIds) {
          terms.push({
            name: `${f}^3`,
            type: 'cubic',
            factors: [f, f, f],
            isHierarchyEnforced: false
          } as any);
        }
      }
    }
  }

  // Build the X matrix
  const X: number[][] = [];

  for (const run of codedData) {
    const row: number[] = [];
    
    for (const term of terms) {
      if (term.type === 'intercept') {
        row.push(1);
      } else if (term.type === 'linear') {
        row.push(run[term.factors[0]] ?? 0);
      } else if (term.type === 'interaction') {
        row.push((run[term.factors[0]] ?? 0) * (run[term.factors[1]] ?? 0));
      } else if (term.type === 'quadratic') {
        const val = run[term.factors[0]] ?? 0;
        row.push(val * val);
      } else if (term.type === 'cubic') {
        const val = run[term.factors[0]] ?? 0;
        row.push(val * val * val);
      }
    }
    X.push(row);
  }

  return { X, terms };
}
