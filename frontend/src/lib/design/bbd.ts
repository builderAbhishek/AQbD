import { Factor, ResponseDefinition, DesignRun } from './ccd'; // Re-use core types

export interface BBDConfig {
  type: 'BBD';
  factors: Factor[];
  centerPoints: number;
  randomize: boolean;
  responses: ResponseDefinition[];
}

export function generateBBD(config: BBDConfig): DesignRun[] {
  const k = config.factors.length;
  if (k < 3 || k > 5) {
    throw new Error('Number of factors must be between 3 and 5 for BBD.');
  }

  const runs: DesignRun[] = [];
  let stdOrder = 1;

  // 1. Generate pairwise combinations
  // For every unique pair of factors (i, j) where i < j
  for (let i = 0; i < k - 1; i++) {
    for (let j = i + 1; j < k; j++) {
      // For each pair, generate 4 combinations: (-1,-1), (1,-1), (-1,1), (1,1)
      // Standard order usually varies i first, then j. So we do:
      const pairs = [
        [-1, -1],
        [ 1, -1],
        [-1,  1],
        [ 1,  1]
      ];

      for (const [valI, valJ] of pairs) {
        const coded: Record<string, number> = {};
        const actual: Record<string, number> = {};

        for (let f = 0; f < k; f++) {
          const factor = config.factors[f];
          const center = (factor.high + factor.low) / 2.0;
          const halfRange = (factor.high - factor.low) / 2.0;

          if (f === i) {
            coded[factor.id] = valI;
            actual[factor.id] = center + valI * halfRange;
          } else if (f === j) {
            coded[factor.id] = valJ;
            actual[factor.id] = center + valJ * halfRange;
          } else {
            coded[factor.id] = 0;
            actual[factor.id] = center;
          }
        }

        runs.push({
          id: `std-${stdOrder}`,
          stdOrder: stdOrder++,
          runOrder: 0,
          isCenter: false,
          isAxial: false,
          codedValues: coded,
          actualValues: actual,
          responses: Object.fromEntries(config.responses.map(r => [r.id, null]))
        });
      }
    }
  }

  // 2. Center points
  const centerCount = Math.max(1, config.centerPoints);
  for (let c = 0; c < centerCount; c++) {
    const coded: Record<string, number> = {};
    const actual: Record<string, number> = {};
    
    for (let f = 0; f < k; f++) {
      const factor = config.factors[f];
      const center = (factor.high + factor.low) / 2.0;
      coded[factor.id] = 0;
      actual[factor.id] = center;
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

  // 3. Randomization
  const runOrders = runs.map(r => r.stdOrder);
  if (config.randomize) {
    // Fisher-Yates shuffle
    for (let x = runOrders.length - 1; x > 0; x--) {
      const y = Math.floor(Math.random() * (x + 1));
      [runOrders[x], runOrders[y]] = [runOrders[y], runOrders[x]];
    }
  }

  runs.forEach((run, idx) => {
    run.runOrder = runOrders[idx];
  });
  
  // Sort by run order so the table displays them in randomized order initially
  runs.sort((a, b) => a.runOrder - b.runOrder);

  return runs;
}

export function generateDefaultBBDConfig(): BBDConfig {
  return {
    type: 'BBD',
    factors: [
      { id: 'f1', name: 'Factor A', units: '', low: -1, high: 1 },
      { id: 'f2', name: 'Factor B', units: '', low: -1, high: 1 },
      { id: 'f3', name: 'Factor C', units: '', low: -1, high: 1 },
    ],
    centerPoints: 3,
    randomize: true,
    responses: [
      { id: 'r1', name: 'Response 1', units: '' }
    ]
  };
}
