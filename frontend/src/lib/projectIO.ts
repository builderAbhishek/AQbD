/**
 * Project Import / Export Utilities for AQbD Studio (.aqbd)
 */

export interface AqbdProjectFile {
  format: 'AQBD_PROJECT';
  version: string;
  exportTimestamp: string;
  appVersion: string;
  project: {
    id?: string;
    name: string;
    status?: string;
    version?: number;
    createdAt?: string;
    updatedAt?: string;
    data: any;
  };
}

export interface ValidationSuccess {
  isValid: true;
  projectData: {
    originalId?: string;
    name: string;
    status: string;
    data: any;
  };
}

export interface ValidationFailure {
  isValid: false;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Sanitizes a project name for use as a file name across operating systems.
 */
export function sanitizeFileName(name: string, fallback = 'Project'): string {
  if (!name || typeof name !== 'string') return fallback;
  // Replace Windows / POSIX invalid filename chars: < > : " / \ | ? * and control chars
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  // Strip trailing periods and spaces (Windows restriction)
  const clean = sanitized.replace(/[. ]+$/, '');
  return clean.length > 0 ? clean : fallback;
}

/**
 * Creates the structured, versioned .aqbd file envelope.
 */
export function createAqbdEnvelope(project: {
  id?: string;
  name: string;
  data: any;
  status?: string;
  version?: number;
}): AqbdProjectFile {
  // Deep clone data to avoid mutating working memory
  const clonedData = JSON.parse(JSON.stringify(project.data || { designs: {} }));

  // Ensure security: remove any internal prototype-pollution keys
  delete clonedData.__proto__;
  delete clonedData.constructor;
  delete clonedData.prototype;

  return {
    format: 'AQBD_PROJECT',
    version: '1.0.0',
    exportTimestamp: new Date().toISOString(),
    appVersion: '1.0.0',
    project: {
      id: project.id,
      name: project.name || '(Untitled)',
      status: project.status || 'Active',
      version: project.version || 1,
      data: clonedData,
    },
  };
}

/**
 * Initiates download of the project as a .aqbd file in the browser.
 */
export function downloadAqbdFile(project: {
  id?: string;
  name: string;
  data: any;
  status?: string;
  version?: number;
}): string {
  const envelope = createAqbdEnvelope(project);
  const jsonString = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const fileName = `${sanitizeFileName(project.name || 'Project')}.aqbd`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fileName;
}

/**
 * Parses and validates an imported .aqbd or legacy JSON project file.
 */
export function parseAndValidateAqbdFile(fileContent: string): ValidationResult {
  if (!fileContent || typeof fileContent !== 'string') {
    return { isValid: false, error: 'File is empty or not a valid string.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err: any) {
    return { isValid: false, error: `Invalid JSON format: ${err.message || 'Syntax error'}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, error: 'Invalid project file: expected a JSON object.' };
  }

  let projectObj: any;

  // Case 1: Standard .aqbd Envelope
  if (parsed.format) {
    if (parsed.format !== 'AQBD_PROJECT') {
      return {
        isValid: false,
        error: `Unsupported format "${parsed.format}". Expected "AQBD_PROJECT".`,
      };
    }

    if (parsed.version && typeof parsed.version === 'string') {
      const [major] = parsed.version.split('.');
      if (major !== '1') {
        return {
          isValid: false,
          error: `Unsupported file version "${parsed.version}". Only version 1.x is currently supported.`,
        };
      }
    }

    if (!parsed.project || typeof parsed.project !== 'object') {
      return { isValid: false, error: 'Malformed .aqbd file: missing "project" section.' };
    }

    projectObj = parsed.project;
  } else {
    // Case 2: Legacy or direct project export (fallback)
    if (!parsed.data && !parsed.designs && !parsed.design) {
      return {
        isValid: false,
        error: 'Invalid file format: Missing "AQBD_PROJECT" format identifier and project data.',
      };
    }
    projectObj = parsed;
  }

  // Validate project name
  const name = typeof projectObj.name === 'string' && projectObj.name.trim()
    ? projectObj.name.trim()
    : 'Imported Project';

  // Validate project data
  let data = projectObj.data;
  if (!data || typeof data !== 'object') {
    if (projectObj.designs || projectObj.design) {
      data = { designs: projectObj.designs, design: projectObj.design, analysis: projectObj.analysis };
    } else {
      return { isValid: false, error: 'Invalid project data: "data" must be an object.' };
    }
  }

  // Deep clone data to avoid prototype pollution
  const cleanData: any = JSON.parse(JSON.stringify(data));
  delete cleanData.__proto__;
  delete cleanData.constructor;
  delete cleanData.prototype;

  // Validate designs structure if present
  if (cleanData.designs && typeof cleanData.designs !== 'object') {
    return { isValid: false, error: 'Corrupted project data: "designs" must be an object.' };
  }

  // Check if designs contain invalid non-object values
  if (cleanData.designs) {
    for (const [key, d] of Object.entries(cleanData.designs)) {
      if (typeof d !== 'object' || d === null) {
        return { isValid: false, error: `Corrupted design data in design entry "${key}".` };
      }
    }
  }

  return {
    isValid: true,
    projectData: {
      originalId: typeof projectObj.id === 'string' ? projectObj.id : undefined,
      name,
      status: typeof projectObj.status === 'string' ? projectObj.status : 'IMPORTED',
      data: cleanData,
    },
  };
}

/**
 * Generates an incremental copy name if a project with the same name already exists.
 */
export function generateCopyName(baseName: string, existingNames: string[]): string {
  const lowerExisting = new Set(existingNames.map(n => n.toLowerCase().trim()));
  let candidate = `${baseName} (Copy)`;
  let counter = 2;

  while (lowerExisting.has(candidate.toLowerCase())) {
    candidate = `${baseName} (Copy ${counter})`;
    counter++;
  }

  return candidate;
}

/**
 * Escapes CSV field value according to RFC 4180.
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC 4180 compliant CSV string for a Design Table.
 */
export function exportDesignTableToCsv(
  design: any,
  viewMode: 'actual' | 'coded' = 'actual'
): string {
  if (!design || !design.config || !design.runs) return '';

  const factors: any[] = design.config.factors || [];
  const responses: any[] = design.config.responses || [];
  const runs: any[] = design.runs || [];

  const headers: string[] = ['Std', 'Run'];
  for (const f of factors) {
    const unitPart = f.units ? ` (${f.units})` : '';
    headers.push(`${f.name}${unitPart}`);
  }
  for (const r of responses) {
    const unitPart = r.units ? ` (${r.units})` : '';
    headers.push(`${r.name}${unitPart}`);
  }

  const rows: string[] = [headers.map(escapeCsvValue).join(',')];

  for (const run of runs) {
    const rowVals: any[] = [run.stdOrder ?? '', run.runOrder ?? ''];

    for (const f of factors) {
      const val = viewMode === 'actual'
        ? run.actualValues?.[f.id]
        : run.codedValues?.[f.id];
      rowVals.push(typeof val === 'number' ? val : (val ?? ''));
    }

    for (const r of responses) {
      const val = run.responses?.[r.id];
      rowVals.push(typeof val === 'number' ? val : (val ?? ''));
    }

    rows.push(rowVals.map(escapeCsvValue).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generates RFC 4180 compliant CSV string for Optimization Solutions.
 */
export function exportOptimizationSolutionsToCsv(
  solutions: any[],
  factors: Array<{ id: string; name: string; units?: string }>,
  responses: Array<{ id: string; name: string; units?: string }>
): string {
  if (!solutions || solutions.length === 0) return '';

  const headers: string[] = ['Number'];
  for (const f of factors) {
    headers.push(f.units ? `${f.name} (${f.units})` : f.name);
  }
  for (const r of responses) {
    headers.push(r.units ? `${r.name} Pred (${r.units})` : `${r.name} Pred`);
    headers.push(`${r.name} Desirability (d)`);
  }
  headers.push('Combined Desirability (D)');

  const rows: string[] = [headers.map(escapeCsvValue).join(',')];

  for (let i = 0; i < solutions.length; i++) {
    const sol = solutions[i];
    const rowVals: any[] = [sol.solutionNumber ?? (i + 1)];

    for (const f of factors) {
      const val = sol.factors?.[f.id];
      rowVals.push(typeof val === 'number' ? Number(val.toFixed(4)) : (val ?? ''));
    }

    for (const r of responses) {
      const predVal = sol.predictions?.[r.id];
      const dVal = sol.individualDesirability?.[r.id];
      rowVals.push(typeof predVal === 'number' ? Number(predVal.toFixed(4)) : (predVal ?? ''));
      rowVals.push(typeof dVal === 'number' ? Number(dVal.toFixed(4)) : (dVal ?? ''));
    }

    rowVals.push(typeof sol.desirability === 'number' ? Number(sol.desirability.toFixed(4)) : (sol.desirability ?? ''));
    rows.push(rowVals.map(escapeCsvValue).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generates RFC 4180 compliant CSV string for Starting Points.
 */
export function exportStartingPointsToCsv(
  startingPoints: any[],
  factors: Array<{ id: string; name: string; units?: string }>
): string {
  if (!startingPoints || startingPoints.length === 0) return '';

  const headers: string[] = ['Point Number'];
  for (const f of factors) {
    headers.push(f.units ? `${f.name} (${f.units})` : f.name);
  }

  const rows: string[] = [headers.map(escapeCsvValue).join(',')];

  for (let i = 0; i < startingPoints.length; i++) {
    const sp = startingPoints[i];
    const rowVals: any[] = [sp.pointNumber ?? (i + 1)];

    for (const f of factors) {
      const val = sp.factors?.[f.id];
      rowVals.push(typeof val === 'number' ? Number(val.toFixed(4)) : (val ?? ''));
    }

    rows.push(rowVals.map(escapeCsvValue).join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generates comprehensive Diagnostic Report CSV covering:
 * 1. Executive Summary & Convergence Status
 * 2. 5-Stage Starting Points Pipeline Diagnostic Table
 * 3. Detailed Starting Points List
 * 4. Optimization Solutions & Desirability breakdown
 */
export function exportOptimizationDiagnosticReport(
  result: any,
  factors: Array<{ id: string; name: string; units?: string }>,
  responses: Array<{ id: string; name: string; units?: string }>
): string {
  const sections: string[] = [];

  // Section 1: Executive Summary
  sections.push(['[SECTION 1: OPTIMIZATION RUN SUMMARY]'].join(','));
  sections.push(['Run ID', result?.runId || 'N/A'].map(escapeCsvValue).join(','));
  sections.push(['Timestamp', result?.timestamp || new Date().toISOString()].map(escapeCsvValue).join(','));
  sections.push(['Convergence Status', result?.status || 'N/A'].map(escapeCsvValue).join(','));
  sections.push(['Message', result?.message || 'Successful convergence'].map(escapeCsvValue).join(','));
  sections.push(['Total Starting Points', result?.startingPoints?.length ?? 0].map(escapeCsvValue).join(','));
  sections.push(['Optimal Solutions Found', result?.solutions?.length ?? 0].map(escapeCsvValue).join(','));
  sections.push('');

  // Section 2: 5-Stage Starting Points Pipeline Table
  const diag = result?.startingPointsDiagnostic;
  sections.push(['[SECTION 2: 5-STAGE STARTING POINTS PIPELINE DIAGNOSTIC]'].join(','));
  sections.push(['Stage', 'Description', 'Count', 'Design-Expert 13 Parity Logic'].map(escapeCsvValue).join(','));
  sections.push(['Stage 1', 'Initial Candidate Pool', diag?.initialDesignCandidates ?? 'N/A', '1 Midpoint + Design Table Runs (up to numberDesignPoints)'].map(escapeCsvValue).join(','));
  sections.push(['Stage 2', 'Rejected Out-of-Bounds', diag?.rejectedOutOfBounds ?? 0, 'Axial or external runs outside factor criteria bounds [low, high]'].map(escapeCsvValue).join(','));
  sections.push(['Stage 3', 'Rejected Duplicates', diag?.rejectedDuplicates ?? 0, 'Center-point replicates and duplicate design points removed'].map(escapeCsvValue).join(','));
  sections.push(['Stage 4', 'Accepted Design Starts', diag?.acceptedDesignPoints ?? 'N/A', 'Unique feasible design points kept for simplex initialization'].map(escapeCsvValue).join(','));
  sections.push(['Stage 5', 'Random Starts Generated', diag?.randomPointsGenerated ?? 'N/A', 'Random starts uniformly sampled inside factor bounds'].map(escapeCsvValue).join(','));
  sections.push(['Stage 6', 'Final Starting Points Used', diag?.totalStartingPoints ?? result?.startingPoints?.length ?? 0, 'Accepted Design Starts + Random Starts (Exact Parity)'].map(escapeCsvValue).join(','));
  sections.push('');

  // Section 3: Evaluated Starting Points Coordinates
  if (result?.startingPoints && result.startingPoints.length > 0) {
    sections.push(['[SECTION 3: EVALUATED STARTING POINTS]'].join(','));
    const spHeaders = ['Point #', 'Source', 'Status'];
    for (const f of factors) {
      spHeaders.push(f.units ? `${f.name} (${f.units})` : f.name);
    }
    sections.push(spHeaders.map(escapeCsvValue).join(','));
    for (let i = 0; i < result.startingPoints.length; i++) {
      const sp = result.startingPoints[i];
      const row = [
        sp.pointNumber ?? (i + 1),
        sp.source || 'start',
        sp.status || 'accepted',
      ];
      for (const f of factors) {
        const val = sp.factors?.[f.id];
        row.push(typeof val === 'number' ? Number(val.toFixed(4)) : (val ?? ''));
      }
      sections.push(row.map(escapeCsvValue).join(','));
    }
    sections.push('');
  }

  // Section 4: Optimization Solutions
  if (result?.solutions && result.solutions.length > 0) {
    sections.push(['[SECTION 4: OPTIMIZATION SOLUTIONS]'].join(','));
    const solHeaders = ['Solution #'];
    for (const f of factors) {
      solHeaders.push(f.units ? `${f.name} (${f.units})` : f.name);
    }
    for (const r of responses) {
      solHeaders.push(r.units ? `Pred: ${r.name} (${r.units})` : `Pred: ${r.name}`);
      solHeaders.push(`d(${r.name})`);
    }
    solHeaders.push('Overall Desirability (D)');
    sections.push(solHeaders.map(escapeCsvValue).join(','));

    for (let i = 0; i < result.solutions.length; i++) {
      const sol = result.solutions[i];
      const row = [sol.solutionNumber ?? (i + 1)];
      for (const f of factors) {
        const val = sol.factors?.[f.id];
        row.push(typeof val === 'number' ? Number(val.toFixed(4)) : (val ?? ''));
      }
      for (const r of responses) {
        const predVal = sol.predictions?.[r.id];
        const dVal = sol.individualDesirability?.[r.id];
        row.push(typeof predVal === 'number' ? Number(predVal.toFixed(4)) : (predVal ?? ''));
        row.push(typeof dVal === 'number' ? Number(dVal.toFixed(4)) : (dVal ?? ''));
      }
      row.push(typeof sol.desirability === 'number' ? Number(sol.desirability.toFixed(4)) : (sol.desirability ?? ''));
      sections.push(row.map(escapeCsvValue).join(','));
    }
  }

  return sections.join('\r\n');
}

/**
 * Downloads a string as a CSV file in the browser.
 */
export function downloadCsvFile(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

