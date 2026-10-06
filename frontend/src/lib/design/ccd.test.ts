import { describe, test, expect } from 'vitest';
import { calculateAlpha, codedToActual, generateCCD, CCDConfig, Factor } from './ccd';

describe('CCD Engine', () => {
  test('calculateAlpha', () => {
    // 2 factors CCC / Full = 4^0.25 = 1.414...
    expect(calculateAlpha(2, 'CCC')).toBeCloseTo(1.4142, 4);
    expect(calculateAlpha(2, 'Full')).toBeCloseTo(1.4142, 4);
    // 3 factors CCC / Full = 8^0.25 = 1.68179...
    expect(calculateAlpha(3, 'CCC')).toBeCloseTo(1.6818, 4);
    expect(calculateAlpha(3, 'Full')).toBeCloseTo(1.6818, 4);
    // 2 factors CCFC = 1
    expect(calculateAlpha(2, 'CCFC')).toBe(1);
    // 3 factors CCI = same as CCC
    expect(calculateAlpha(3, 'CCI')).toBeCloseTo(1.6818, 4);
  });

  test('codedToActual - Full', () => {
    const f: Factor = { id: 'f1', name: 'A', units: '', low: 50, high: 80 }; // center=65, scale=15
    const alpha = 1.4142135623730951;
    expect(codedToActual(-1, f, alpha, 'Full')).toBeCloseTo(50, 4);
    expect(codedToActual(1, f, alpha, 'Full')).toBeCloseTo(80, 4);
    expect(codedToActual(0, f, alpha, 'Full')).toBeCloseTo(65, 4);
    expect(codedToActual(-alpha, f, alpha, 'Full')).toBeCloseTo(65 - 15 * alpha, 4);
  });

  test('generateCCD - 2 factors, Full', () => {
    const config: CCDConfig = {
      type: 'Full',
      factors: [
        { id: 'f1', name: 'A', units: '', low: -1, high: 1 },
        { id: 'f2', name: 'B', units: '', low: -1, high: 1 }
      ],
      blocks: 1,
      centerPoints: 5,
      randomize: false,
      responses: [{ id: 'r1', name: 'R1', units: '' }]
    };

    const runs = generateCCD(config);
    // 4 factorial + 4 axial + 5 center = 13 runs
    expect(runs.length).toBe(13);
    
    // Check factorial points
    expect(runs[0].codedValues).toEqual({ f1: -1, f2: -1 });
    expect(runs[1].codedValues).toEqual({ f1: 1, f2: -1 });
    expect(runs[2].codedValues).toEqual({ f1: -1, f2: 1 });
    expect(runs[3].codedValues).toEqual({ f1: 1, f2: 1 });

    // Check axial points (alpha = 1.4142...)
    const alpha = calculateAlpha(2, 'Full');
    // Ensure it is NOT 0.7071
    expect(Math.abs(alpha - 0.7071)).toBeGreaterThan(0.1);

    expect(runs[4].codedValues.f1).toBeCloseTo(-alpha, 4);
    expect(runs[4].codedValues.f2).toBeCloseTo(0, 4);

    // Check center points count
    const centerRuns = runs.filter(r => r.isCenter);
    expect(centerRuns.length).toBe(5);

    // Check Block assignment
    for (const run of runs) {
      expect(run.block).toBe(1);
    }
  });

  test('generateCCD - Randomization only changes Run Order', () => {
    const config: CCDConfig = {
      type: 'Full',
      factors: [
        { id: 'f1', name: 'A', units: '', low: 10, high: 20 },
        { id: 'f2', name: 'B', units: '', low: 1, high: 5 }
      ],
      blocks: 1,
      centerPoints: 5,
      randomize: true,
      responses: []
    };

    const runs = generateCCD(config);
    expect(runs.length).toBe(13);
    
    // Standard order should still be 1..13
    const stdOrders = runs.map(r => r.stdOrder).sort((a,b) => a-b);
    expect(stdOrders[0]).toBe(1);
    expect(stdOrders[12]).toBe(13);

    // Run order should be 1..13, but the array is sorted by runOrder
    expect(runs[0].runOrder).toBe(1);
    expect(runs[12].runOrder).toBe(13);
  });
});
