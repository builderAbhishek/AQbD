import { FittedModel, FactorDefinition } from './types';

export function generateCodedEquation(model: FittedModel): string {
  const termsStr = model.coefficients.map((coef, i) => {
    const term = model.terms[i];
    // Actually, simple toFixed(4) is more standard unless it's very small
    const formatCoef = (c: number) => {
      const absC = Math.abs(c);
      if (absC < 0.0001 && absC > 0) return c.toExponential(4);
      return c.toFixed(4);
    };
    
    let sign = coef >= 0 ? '+' : '-';
    if (i === 0) sign = coef >= 0 ? '' : '-'; // no leading + for intercept

    const absValStr = formatCoef(Math.abs(coef));

    if (term.type === 'intercept') {
      return `${sign} ${absValStr}`.trim();
    } else {
      const varName = term.name;
      return `${sign} ${absValStr} ${varName}`;
    }
  });

  return termsStr.join('\n');
}

export function generateActualEquation(model: FittedModel, factors: FactorDefinition[]): string {
  // Convert coded equation back to actual
  // A_coded = (A_act - centerA) / halfRangeA
  // This requires algebraic expansion.
  // For V1, the request mentions "Actually transform the equation".
  // Let's implement an expansion logic.

  // We can track terms: [constant, linearMap, quadraticMap, interactionMap]
  let intercept = model.coefficients[0];
  const linear = new Map<string, number>(); // factorId -> coef
  const quad = new Map<string, number>(); // factorId -> coef
  const int = new Map<string, number>(); // "fid1*fid2" -> coef

  // Initialize
  for (const f of factors) {
    linear.set(f.id, 0);
    quad.set(f.id, 0);
  }
  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      int.set(`${factors[i].id}*${factors[j].id}`, 0);
    }
  }

  const center = (f: FactorDefinition) => (f.high + f.low) / 2;
  const halfRange = (f: FactorDefinition) => (f.high - f.low) / 2;

  // Add the contributions of each coded term to the actual equation parameters
  for (let i = 1; i < model.coefficients.length; i++) {
    const coef = model.coefficients[i];
    const term = model.terms[i];

    if (term.type === 'linear') {
      const f1 = factors.find(f => f.id === term.factors[0])!;
      const c = center(f1);
      const h = halfRange(f1);
      
      // coef * (X - c) / h = (coef/h)*X - (coef*c)/h
      intercept -= (coef * c) / h;
      linear.set(f1.id, linear.get(f1.id)! + (coef / h));

    } else if (term.type === 'quadratic') {
      const f1 = factors.find(f => f.id === term.factors[0])!;
      const c = center(f1);
      const h = halfRange(f1);
      
      // coef * ((X - c)/h)^2 = coef/h^2 * X^2 - 2*coef*c/h^2 * X + coef*c^2/h^2
      intercept += (coef * c * c) / (h * h);
      linear.set(f1.id, linear.get(f1.id)! - (2 * coef * c) / (h * h));
      quad.set(f1.id, quad.get(f1.id)! + (coef) / (h * h));

    } else if (term.type === 'interaction') {
      const f1 = factors.find(f => f.id === term.factors[0])!;
      const f2 = factors.find(f => f.id === term.factors[1])!;
      const c1 = center(f1);
      const h1 = halfRange(f1);
      const c2 = center(f2);
      const h2 = halfRange(f2);

      // coef * (X1 - c1)/h1 * (X2 - c2)/h2 
      // = (coef/(h1*h2)) * (X1*X2 - c2*X1 - c1*X2 + c1*c2)
      intercept += (coef * c1 * c2) / (h1 * h2);
      linear.set(f1.id, linear.get(f1.id)! - (coef * c2) / (h1 * h2));
      linear.set(f2.id, linear.get(f2.id)! - (coef * c1) / (h1 * h2));
      
      const key = `${f1.id}*${f2.id}`;
      int.set(key, int.get(key)! + (coef / (h1 * h2)));
    }
  }

  // Format the output string
  const formatCoef = (c: number) => {
    const absC = Math.abs(c);
    if (absC < 0.0001 && absC > 0) return c.toExponential(5);
    return c.toFixed(5);
  };

  const parts = [];
  parts.push(`${intercept < 0 ? '-' : ''}${formatCoef(Math.abs(intercept))}`);

  for (const f of factors) {
    const val = linear.get(f.id)!;
    if (Math.abs(val) > 1e-12) {
      parts.push(`${val < 0 ? '-' : '+'} ${formatCoef(Math.abs(val))} * ${f.name}`);
    }
  }

  for (const f of factors) {
    const val = quad.get(f.id)!;
    if (Math.abs(val) > 1e-12) {
      parts.push(`${val < 0 ? '-' : '+'} ${formatCoef(Math.abs(val))} * ${f.name}^2`);
    }
  }

  for (let i = 0; i < factors.length; i++) {
    for (let j = i + 1; j < factors.length; j++) {
      const key = `${factors[i].id}*${factors[j].id}`;
      const val = int.get(key)!;
      if (Math.abs(val) > 1e-12) {
        parts.push(`${val < 0 ? '-' : '+'} ${formatCoef(Math.abs(val))} * ${factors[i].name} * ${factors[j].name}`);
      }
    }
  }

  return parts.join('\n');
}
