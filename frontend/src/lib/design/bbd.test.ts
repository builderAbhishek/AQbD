import { describe, test, expect } from 'vitest';

import { generateBBD, BBDConfig } from './bbd';



describe('BBD Engine', () => {

  const createBaseConfig = (factorCount: number): BBDConfig => {

    const factors = [];

    for (let i = 0; i < factorCount; i++) {

      factors.push({ id: `f${i}`, name: `F${i}`, units: '', low: 10, high: 20 });

    }

    return {

      type: 'BBD',

      factors,

      centerPoints: 3,

      randomize: false,

      responses: []

    };

  };



  test('3 factors - correct size', () => {

    const config = createBaseConfig(3);

    const runs = generateBBD(config);

    // 2 * 3 * 2 = 12 non-center + 3 center = 15

    expect(runs.length).toBe(15);

    const centers = runs.filter(r => r.isCenter);

    expect(centers.length).toBe(3);

  });



  test('4 factors - correct size', () => {

    const config = createBaseConfig(4);

    const runs = generateBBD(config);

    // 2 * 4 * 3 = 24 non-center + 3 center = 27

    expect(runs.length).toBe(27);

  });



  test('5 factors - correct size', () => {

    const config = createBaseConfig(5);

    const runs = generateBBD(config);

    // 2 * 5 * 4 = 40 non-center + 3 center = 43

    expect(runs.length).toBe(43);

  });



  test('Invariants checking for 3 factors', () => {

    const config = createBaseConfig(3);

    // Low = 10, High = 20, center = 15, half = 5

    const runs = generateBBD(config);



    for (const run of runs) {

      const codedVals = Object.values(run.codedValues);

      

      if (run.isCenter) {

        expect(codedVals.every(v => v === 0)).toBe(true);

        // check actual values

        const actualVals = Object.values(run.actualValues);

        expect(actualVals.every(v => v === 15)).toBe(true);

      } else {

        // Count how many factors are exactly at 1 or -1

        const activeCount = codedVals.filter(Math.abs).length;

        expect(activeCount).toBe(2);

        

        // Count how many are exactly at 0

        const zeroCount = codedVals.filter(v => v === 0).length;

        expect(zeroCount).toBe(1);



        // Check actual values matching the coded ones

        Object.entries(run.codedValues).forEach(([fid, val]) => {

          if (val === -1) expect(run.actualValues[fid]).toBe(10);

          if (val === 1) expect(run.actualValues[fid]).toBe(20);

          if (val === 0) expect(run.actualValues[fid]).toBe(15);

        });

      }

    }

  });



  test('Randomization works', () => {

    const config = createBaseConfig(3);

    config.randomize = true;

    const runs = generateBBD(config);

    

    // Total runs is 15

    expect(runs.length).toBe(15);

    

    // Check that standard orders contain 1 to 15

    const stdOrders = runs.map(r => r.stdOrder).sort((a, b) => a - b);

    expect(stdOrders[0]).toBe(1);

    expect(stdOrders[14]).toBe(15);

    

    // Run orders should be 1 to 15

    const runOrders = runs.map(r => r.runOrder).sort((a, b) => a - b);

    expect(runOrders[0]).toBe(1);

    expect(runOrders[14]).toBe(15);

  });

});
