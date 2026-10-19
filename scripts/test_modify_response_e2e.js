const http = require('http');

http.get('http://localhost:3001/api/v1/projects', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const projects = JSON.parse(data);
    const p = projects[0];
    const designId = Object.keys(p.data.designs)[0];
    const design = p.data.designs[designId];

    console.log('Project ID:', p.id);
    console.log('Design ID:', designId);

    // Initial optimize call
    const postData = JSON.stringify({ designId });
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/projects/' + p.id + '/optimize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, optRes => {
      let optData = '';
      optRes.on('data', chunk => optData += chunk);
      optRes.on('end', () => {
        const parsed = JSON.parse(optData);
        const pred1 = parsed.result?.solutions?.[0]?.predictions?.r1;
        console.log('Opt 1 Status:', parsed.result?.status);
        console.log('Opt 1 Sol #1 r1 prediction:', pred1);

        // Modify response in run 1 (std 6) for r1 from 3.08 to 4.50
        const updatedRuns = [...design.runs];
        updatedRuns[0] = {
          ...updatedRuns[0],
          responses: { ...updatedRuns[0].responses, r1: 4.50 }
        };

        const updatedAnalyses = { ...design.analyses };
        if (updatedAnalyses.r1) {
          updatedAnalyses.r1 = {
            ...updatedAnalyses.r1,
            isOutdated: true,
            outdatedReason: 'Response data modified in run 1'
          };
        }

        const updatedProjectData = {
          ...p.data,
          designs: {
            ...p.data.designs,
            [designId]: {
              ...design,
              runs: updatedRuns,
              analyses: updatedAnalyses,
              runsModifiedAt: new Date().toISOString()
            }
          }
        };

        // Update project via PUT
        const putData = JSON.stringify({ name: p.name, data: updatedProjectData });
        const putReq = http.request({
          hostname: 'localhost',
          port: 3001,
          path: '/api/v1/projects/' + p.id,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(putData)
          }
        }, putRes => {
          let putResData = '';
          putRes.on('data', chunk => putResData += chunk);
          putRes.on('end', () => {
            console.log('Project updated via PUT with r1 = 4.50 in run 1');

            // Run optimize again!
            const req2 = http.request({
              hostname: 'localhost',
              port: 3001,
              path: '/api/v1/projects/' + p.id + '/optimize',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            }, optRes2 => {
              let optData2 = '';
              optRes2.on('data', chunk => optData2 += chunk);
              optRes2.on('end', () => {
                const parsed2 = JSON.parse(optData2);
                const pred2 = parsed2.result?.solutions?.[0]?.predictions?.r1;
                console.log('Opt 2 Status:', parsed2.result?.status);
                console.log('Opt 2 Sol #1 r1 prediction:', pred2);
                console.log('Prediction comparison:');
                console.log('  Original r1 prediction:', pred1);
                console.log('  Updated  r1 prediction:', pred2);
                const diff = Math.abs(pred2 - pred1);
                console.log('  Diff:', diff);
                console.log('  Updated as expected?', diff > 0.05);

                // Revert response in run 1 back to 3.08
                updatedRuns[0] = {
                  ...updatedRuns[0],
                  responses: { ...updatedRuns[0].responses, r1: 3.08 }
                };
                const revertAnalyses = { ...parsed2.project?.data?.designs?.[designId]?.analyses };
                if (revertAnalyses.r1) {
                  revertAnalyses.r1 = { ...revertAnalyses.r1, isOutdated: true };
                }
                const revertData = JSON.stringify({
                  name: p.name,
                  data: {
                    ...p.data,
                    designs: {
                      ...p.data.designs,
                      [designId]: {
                        ...design,
                        runs: updatedRuns,
                        analyses: revertAnalyses,
                        runsModifiedAt: new Date().toISOString()
                      }
                    }
                  }
                });
                const revReq = http.request({
                  hostname: 'localhost',
                  port: 3001,
                  path: '/api/v1/projects/' + p.id,
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(revertData)
                  }
                }, () => {
                  // Run optimize once more to re-normalize models in database
                  const reNorm = http.request({
                    hostname: 'localhost',
                    port: 3001,
                    path: '/api/v1/projects/' + p.id + '/optimize',
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(postData)
                    }
                  }, () => {
                    console.log('Database successfully re-normalized to original 3.08 data.');
                  });
                  reNorm.write(postData);
                  reNorm.end();
                });
                revReq.write(revertData);
                revReq.end();
              });
            });
            req2.write(postData);
            req2.end();
          });
        });
        putReq.write(putData);
        putReq.end();
      });
    });
    req.write(postData);
    req.end();
  });
});
