export type CCDType = 'CCC' | 'CCI' | 'CCFC' | 'Full';

export interface Factor {
  id: string;
  name: string;
  units: string;
  low: number; // For CCC/CCFC/Full, this is -1 level. For CCI, this is -alpha level.
  high: number; // For CCC/CCFC/Full, this is +1 level. For CCI, this is +alpha level.
}

export interface ResponseDefinition {
  id: string;
  name: string;
  units: string;
  description?: string;
}

export interface CCDConfig {
  type: CCDType;
  factors: Factor[];
  centerPoints: number;
  blocks?: number; // Added blocks
  randomize: boolean;
  responses: ResponseDefinition[];
}

export interface DesignRun {
  id: string;
  stdOrder: number;
  runOrder: number;
  block?: number; // Added block
  isCenter: boolean;
  isAxial: boolean;
  // Factor values
  codedValues: Record<string, number>;
  actualValues: Record<string, number>;
  // Response values
  responses: Record<string, number | null>;
}

export function calculateAlpha(factorsCount: number, type: CCDType): number {
  if (factorsCount < 2) throw new Error('CCD requires at least 2 factors');
  if (type === 'CCFC') return 1;
  // For CCC, CCI, and Full, alpha = (2^k)^0.25
  return Math.pow(Math.pow(2, factorsCount), 0.25);
}

// Converts a coded value to an actual value
export function codedToActual(coded: number, factor: Factor, alpha: number, type: CCDType): number {
  const center = (factor.high + factor.low) / 2.0;
  const halfRange = (factor.high - factor.low) / 2.0;
  
  let scale = halfRange;
  if (type === 'CCI') {
    // For Inscribed, the low/high represent the -alpha/+alpha points
    scale = halfRange / alpha;
  }
  
  return center + (coded * scale);
}

// Converts an actual value to a coded value
export function actualToCoded(actual: number, factor: Factor, alpha: number, type: CCDType): number {
  const center = (factor.high + factor.low) / 2.0;
  const halfRange = (factor.high - factor.low) / 2.0;
  
  let scale = halfRange;
  if (type === 'CCI') {
    scale = halfRange / alpha;
  }
  
  return (actual - center) / scale;
}

export function generateCCD(config: CCDConfig): DesignRun[] {
  const k = config.factors.length;
  if (k < 2 || k > 5) {
    throw new Error('Number of factors must be between 2 and 5 for V1.');
  }

  const alpha = calculateAlpha(k, config.type);
  const runs: DesignRun[] = [];
  let stdOrder = 1;

  // 1. Factorial points (2^k)
  const factorialCount = Math.pow(2, k);
  for (let i = 0; i < factorialCount; i++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    
    // Standard order mapping (Yates order: A varies fastest, then B, etc.)
    for (let f = 0; f < k; f++) {
      // Bit check: if the f-th bit of i is 1, it's +1, else -1
      const sign = (i & (1 << f)) ? 1 : -1;
      const factor = config.factors[f];
      coded[factor.id] = sign;
      actual[factor.id] = codedToActual(sign, factor, alpha, config.type);
    }

    runs.push({
      id: `std-${stdOrder}`,
      stdOrder: stdOrder++,
      runOrder: 0, // Assigned later
      isCenter: false,
      isAxial: false,
      codedValues: coded,
      actualValues: actual,
      responses: Object.fromEntries(config.responses.map(r => [r.id, null]))
    });
  }

  // 2. Axial (Star) points (2k)
  for (let f = 0; f < k; f++) {
    for (const sign of [-1, 1]) {
      const coded: Record<string, number> = {};
      const actual: Record<string, number> = {};
      
      for (let j = 0; j < k; j++) {
        const factor = config.factors[j];
        if (j === f) {
          const val = sign * alpha;
          coded[factor.id] = val;
          actual[factor.id] = codedToActual(val, factor, alpha, config.type);
        } else {
          coded[factor.id] = 0;
          actual[factor.id] = codedToActual(0, factor, alpha, config.type);
        }
      }

      runs.push({
        id: `std-${stdOrder}`,
        stdOrder: stdOrder++,
        runOrder: 0,
        isCenter: false,
        isAxial: true,
        codedValues: coded,
        actualValues: actual,
        responses: Object.fromEntries(config.responses.map(r => [r.id, null]))
      });
    }
  }

  // 3. Center points
  const centerCount = Math.max(1, config.centerPoints);
  for (let c = 0; c < centerCount; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    
    for (let j = 0; j < k; j++) {
      const factor = config.factors[j];
      coded[factor.id] = 0;
      actual[factor.id] = codedToActual(0, factor, alpha, config.type);
    }

    runs.push({
      id: `std-${stdOrder}`,
      stdOrder: stdOrder++,
      runOrder: 0,
      isCenter: true,
      isAxial: false,
      codedValues: coded,
      actualValues: actual,
      responses: Object.fromEntries(config.responses.map(r => [r.id, null]))
    });
  }

  // 4. Randomization
  const runOrders = runs.map(r => r.stdOrder);
  if (config.randomize) {
    // Fisher-Yates shuffle
    for (let i = runOrders.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [runOrders[i], runOrders[j]] = [runOrders[j], runOrders[i]];
    }
  }

  runs.forEach((run, idx) => {
    run.runOrder = runOrders[idx];
    run.block = 1; // Block assignment mathematics not implemented for >1 yet
  });
  
  // Sort by run order so the table displays them in randomized order initially
  runs.sort((a, b) => a.runOrder - b.runOrder);

  return runs;
}

export function generateDefaultCCDConfig(): CCDConfig {
  return {
    type: 'Full',
    factors: [
      { id: 'f1', name: 'Factor A', units: '', low: -1, high: 1 },
      { id: 'f2', name: 'Factor B', units: '', low: -1, high: 1 },
    ],
    centerPoints: 5,
    blocks: 1,
    randomize: true,
    responses: [
      { id: 'r1', name: 'Response 1', units: '' }
    ]
  };
}
