const http = require('http');

http.get('http://localhost:3001/api/v1/projects', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const d = projects[0].data.designs[Object.keys(projects[0].data.designs)[0]];
    const factors = d.config.factors;
    const analyses = d.analyses;

    function actualToCoded(act, low, high) {
      return (act - (low + high) / 2) / ((high - low) / 2);
    }

    function predictCoded(coeffs, xA, xB, xC) {
      // ["Intercept","f1","f2","f1792184538988","f1*f2","f1*f1792184538988","f2*f1792184538988","f1^2","f2^2","f1792184538988^2"]
      return (
        coeffs[0] +
        coeffs[1] * xA +
        coeffs[2] * xB +
        coeffs[3] * xC +
        coeffs[4] * xA * xB +
        coeffs[5] * xA * xC +
        coeffs[6] * xB * xC +
        coeffs[7] * xA * xA +
        coeffs[8] * xB * xB +
        coeffs[9] * xC * xC
      );
    }

    const p1 = { name: 'Point 1', act: { f1: 45, f2: 2.5, f1792184538988: 35 } };
    const p2 = { name: 'Point 2', act: { f1: 41.535, f2: 2.873, f1792184538988: 31.926 } };

    [p1, p2].forEach(p => {
      console.log('=== ' + p.name + ' ===');
      const xA = actualToCoded(p.act.f1, 35, 45);
      const xB = actualToCoded(p.act.f2, 2.5, 3.5);
      const xC = actualToCoded(p.act.f1792184538988, 25, 35);
      console.log('Actual:', p.act);
      console.log('Coded: xA =', xA, 'xB =', xB, 'xC =', xC);

      for (const [rId, resp] of Object.entries(analyses)) {
        const rName = d.config.responses.find(r => r.id === rId)?.name || rId;
        const pred = predictCoded(resp.fittedModel.coefficients, xA, xB, xC);
        console.log('  ' + rName + ' (' + rId + ') Predicted:', pred);
      }
    });
  });
});
