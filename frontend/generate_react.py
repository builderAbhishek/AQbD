import os

pages = {
    "Diagnostics.tsx": """import React from 'react';
export default function Diagnostics() { return <div className='p-4'><h2>Diagnostics</h2><p>Integrated into Analysis response. Charts would render here using Plotly.</p></div>; }
""",
    "Optimization.tsx": """import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Optimization() {
  const [projectId, setProjectId] = useState(1);
  const [results, setResults] = useState<any>(null);

  const runOpt = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/optimization/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis_ids: [], settings: {} })
      });
      return res.json();
    },
    onSuccess: (data) => setResults(data)
  });

  return (
    <div className='p-4'>
      <h2 className="text-2xl font-bold mb-4">Optimization</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <input type="number" value={projectId} onChange={e => setProjectId(Number(e.target.value))} className="border p-2 mr-2" placeholder="Project ID" />
        <button onClick={() => runOpt.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded">Run Desirability</button>
      </div>
      {results && <pre className="bg-gray-100 p-2 text-sm">{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
""",
    "DesignSpace.tsx": """import React from 'react';
export default function DesignSpace() { return <div className='p-4'><h2>Design Space</h2><p>Working implementation required...</p></div>; }
""",
    "Confirmation.tsx": """import React from 'react';
export default function Confirmation() { return <div className='p-4'><h2>Confirmation</h2><p>Working implementation required...</p></div>; }
""",
    "Reports.tsx": """import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Reports() {
  const [projectId, setProjectId] = useState(1);
  const [results, setResults] = useState<any>(null);

  const generateReport = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/reports/`, { method: 'POST' });
      return res.json();
    },
    onSuccess: (data) => setResults(data)
  });

  return (
    <div className='p-4'>
      <h2 className="text-2xl font-bold mb-4">PDF Reports</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <input type="number" value={projectId} onChange={e => setProjectId(Number(e.target.value))} className="border p-2 mr-2" placeholder="Project ID" />
        <button onClick={() => generateReport.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded">Generate PDF</button>
      </div>
      {results && <p>Report generated at: {results.file_path}</p>}
    </div>
  );
}
"""
}

base_dir = "f:/Developer Abhishek/Website/AQbD/frontend/src/pages/"
for name, content in pages.items():
    with open(os.path.join(base_dir, name), "w", encoding="utf-8") as f:
        f.write(content)

print("More pages created successfully.")
