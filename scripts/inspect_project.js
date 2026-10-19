const http = require('http');

http.get('http://localhost:3001/api/v1/projects', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const d = projects[0].data.designs[Object.keys(projects[0].data.designs)[0]];
    console.log('=== DESIGN FACTORS ===');
    console.log(JSON.stringify(d.config?.factors, null, 2));
    console.log('=== DESIGN RESPONSES ===');
    console.log(JSON.stringify(d.config?.responses, null, 2));
    console.log('=== 20 RUNS ===');
    d.runs.forEach(r => {
      console.log('Run ' + r.runOrder + ' (Std ' + r.stdOrder + '): factors=' + JSON.stringify(r.actualValues) + ' coded=' + JSON.stringify(r.codedValues) + ' responses=' + JSON.stringify(r.responses));
    });
    console.log('=== ANALYSES ===');
    for (const [k, v] of Object.entries(d.analyses || {})) {
      console.log('Response ' + k + ' (' + v.modelType + ')');
      console.log('  R2: ' + v.fittedModel?.R2 + ' AdjR2: ' + v.fittedModel?.adjR2);
      console.log('  Terms: ' + JSON.stringify(v.fittedModel?.terms?.map(t => t.name)));
      console.log('  Coefficients: ' + JSON.stringify(v.fittedModel?.coefficients));
      console.log('  Coded eq:\n' + v.fittedModel?.codedEquation);
    }
    console.log('=== OPTIMIZATION SOLUTIONS ===');
    const sols = d.optimization?.results?.solutions;
    console.log('Total solutions:', sols?.length);
    if (sols && sols.length > 0) {
      sols.slice(0, 5).forEach(s => {
        console.log('#' + s.solutionNumber + ' D=' + s.desirability.toFixed(5) + ' factors=' + JSON.stringify(s.factors) + ' predictions=' + JSON.stringify(s.predictions));
      });
    }
  });
});
