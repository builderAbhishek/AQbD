import os

base = "frontend/src/pages/"

files = {
    "ATP.tsx": """import React from 'react';
export default function ATP() { return <div className='p-4'><h2>ATP</h2><p>Working implementation required...</p></div>; }
""",
    "Risk.tsx": """import React from 'react';
export default function Risk() { return <div className='p-4'><h2>Risk</h2><p>Working implementation required...</p></div>; }
""",
    "Factors.tsx": """import React from 'react';
export default function Factors() { return <div className='p-4'><h2>Factors</h2><p>Working implementation required...</p></div>; }
""",
    "Responses.tsx": """import React from 'react';
export default function Responses() { return <div className='p-4'><h2>Responses</h2><p>Working implementation required...</p></div>; }
"""
}

for name, content in files.items():
    with open(os.path.join(base, name), "w") as f:
        f.write(content)
