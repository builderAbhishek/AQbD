export type ModelType = 'Linear' | '2FI' | 'Quadratic';

export interface TermMetadata {
  name: string;
  type: 'intercept' | 'linear' | 'interaction' | 'quadratic';
  factors: string[]; // factor IDs
  isHierarchyEnforced?: boolean;
}

export interface ModelMatrixResult {
  X: number[][]; // N x p matrix
  terms: TermMetadata[];
}

export interface FactorDefinition {
  id: string;
  name: string;
  low: number; // coded -1 value
  high: number; // coded +1 value
  units?: string;
}

export interface CoefficientRow {
  term: string;
  type: 'intercept' | 'linear' | 'interaction' | 'quadratic';
  estimate: number;
  df: number;
  standardError: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  vif: number | null; // null for intercept or when not estimable
}

// Result of a fitted model
export interface FittedModel {
  modelType: ModelType;
  coefficients: number[]; // Length matches terms
  terms: TermMetadata[];
  coefficientTable: CoefficientRow[];
  
  // Basic Stats
  n: number;
  p: number; // number of coefficients (including intercept)
  
  // Sum of Squares
  SST: number;
  SSE: number;
  SSR: number; // SS Model
  
  // Degrees of freedom
  dfTotal: number;
  dfModel: number;
  dfError: number;
  
  // Mean Squares
  msModel: number | null;
  msError: number | null;
  fModel: number | null;
  pModel: number | null;

  // Metrics
  R2: number | null;
  adjR2: number | null;
  predR2: number | null;
  rmse: number | null;
  mean: number;
  cv: number | null;
  adequatePrecision: number | null;
  press: number | null;

  // Equations
  codedEquation: string;
  actualEquation?: string;
}

export interface AnovaRow {
  source: string;
  ss: number;
  df: number;
  ms: number | null;
  fValue: number | null;
  pValue: number | null;
  isTerm?: boolean;
}

export interface LackOfFitResult {
  ssLOF: number;
  dfLOF: number;
  msLOF: number;
  ssPureError: number;
  dfPureError: number;
  msPureError: number;
  fValue: number | null;
  pValue: number | null;
  available: boolean;
  message?: string;
}

export interface ObservationDiagnostic {
  runId: string | null;
  standardOrder: number;
  runOrder: number;
  observed: number;
  predicted: number;
  residual: number;
  leverage: number | null;
}

export interface ModelComparisonRow {
  modelType: ModelType;
  df: number;
  p: number;
  r2: number | null;
  adjR2: number | null;
  predR2: number | null;
  rmse: number | null;
  press: number | null;
  sequentialPValue: number | null;
  lackOfFitPValue: number | null;
  adequatePrecision: number | null;
  suggested?: boolean;
  status: 'Suggested' | 'Alternative' | 'Aliased' | 'Overfitted';
}

export interface RSMAnalysis {
  responseId: string;
  modelType: ModelType;
  factors: FactorDefinition[];
  fittedModel: FittedModel;
  fitted?: FittedModel; // Compatibility alias
  anova: AnovaRow[];
  lackOfFit: LackOfFitResult;
  diagnostics?: ObservationDiagnostic[];
  modelComparison?: ModelComparisonRow[];
  timestamp: string;
}
