import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { executeOptimizationService } from '../services/optimizationService';

const router = Router();

// GET /api/v1/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/v1/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Update lastOpenedAt
    await prisma.project.update({
      where: { id: project.id },
      data: { lastOpenedAt: new Date() },
    });
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/v1/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, data } = req.body;
    
    const project = await prisma.project.create({
      data: {
        name: name || '(Untitled)',
        data: data || {},
        status: 'NEW',
        lastOpenedAt: new Date(),
      },
    });
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/v1/projects/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, data, status } = req.body;
    
    const updateData: any = {
      version: { increment: 1 }
    };
    
    if (name !== undefined) updateData.name = name;
    if (data !== undefined) updateData.data = data;
    if (status !== undefined) updateData.status = status;
    
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
    });
    
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/v1/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id },
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/v1/projects/:id/duplicate
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const existingProject = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const duplicatedProject = await prisma.project.create({
      data: {
        name: `${existingProject.name} (Copy)`,
        data: existingProject.data || {},
        status: existingProject.status,
      },
    });
    
    res.status(201).json(duplicatedProject);
  } catch (error) {
    console.error('Error duplicating project:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// PUT /api/v1/projects/:id/archive
router.put('/:id/archive', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
    });
    
    res.json(project);
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

function sanitizeFileName(name: string, fallback = 'Project'): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : fallback;
}

// GET /api/v1/projects/:id/export
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const payload = {
      format: 'AQBD_PROJECT',
      version: '1.0.0',
      exportTimestamp: new Date().toISOString(),
      appVersion: '1.0.0',
      project: {
        name: project.name,
        status: project.status,
        version: project.version,
        data: project.data || { designs: {} },
      },
    };
    
    const filename = `${sanitizeFileName(project.name)}.aqbd`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Error exporting project:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

// POST /api/v1/projects/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    let { name, data, status, format, version, project, envelope, targetName } = req.body;

    // Handle envelope wrapper if provided
    if (envelope && typeof envelope === 'object') {
      format = format || envelope.format;
      version = version || envelope.version;
      project = project || envelope.project;
    }

    // Handle envelope or project object if whole .aqbd file payload is posted
    if (project && typeof project === 'object') {
      name = targetName || name || project.name;
      data = data || project.data;
      status = status || project.status;
    }

    if (targetName) {
      name = targetName;
    }

    // Format validation if format specified
    if (format && format !== 'AQBD_PROJECT') {
      return res.status(400).json({ error: 'Invalid file format. Expected AQBD_PROJECT.' });
    }

    // Version check (allow 1.x)
    if (version && typeof version === 'string' && !version.startsWith('1.')) {
      return res.status(400).json({ error: `Unsupported project version: ${version}. Supported versions: 1.x` });
    }

    if (!name || typeof name !== 'string') {
      name = 'Imported Project';
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid project data payload: data must be an object' });
    }

    // Ensure data has designs or design
    if (!data.designs && !data.design) {
      data = { ...data, designs: {} };
    }

    // If data.design exists without designs, migrate it
    if (data.design && !data.designs) {
      const designId = data.design.id || `design_${Date.now()}`;
      data.design.id = designId;
      data.designs = { [designId]: data.design };
      delete data.design;
    }

    const importedProject = await prisma.project.create({
      data: {
        name: name.slice(0, 255),
        data: data,
        status: status || 'IMPORTED',
        lastOpenedAt: new Date(),
      },
    });

    res.status(201).json(importedProject);
  } catch (error: any) {
    console.error('Error importing project:', error);
    res.status(500).json({ error: error.message || 'Failed to import project' });
  }
});
    
// POST /api/v1/projects/:id/optimize
router.post('/:id/optimize', async (req: Request, res: Response) => {
  try {
    const { designId } = req.body;
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectData = (project.data as any) || {};
    const designs = projectData.designs || {};
    const targetDesignId = designId || Object.keys(designs)[0];

    if (!targetDesignId || !designs[targetDesignId]) {
      return res.status(400).json({ error: 'No valid design found in project to optimize.' });
    }

    const design = designs[targetDesignId];
    const factors = (design.config?.factors || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      low: Number(f.low),
      high: Number(f.high),
      units: f.units,
    }));
    const responses = (design.config?.responses || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      units: r.units,
    }));
    const analyses = { ...(projectData.analysis || {}), ...(design.analyses || {}) };
    const criteria = design.optimization?.criteria || {};
    const options = design.optimization?.options || {
      randomStartingPoints: 100,
      numberDesignPoints: 50,
      duplicateFilter: 0.5,
      simplexFraction: 0.1,
      maxSolutions: 100,
      includeStdError: false,
    };
    const runs = design.runs || [];

    const result = executeOptimizationService(
      factors,
      responses,
      analyses,
      criteria,
      options,
      runs,
      design.runsModifiedAt
    );

    if (result.status === 'error') {
      return res.status(400).json({ error: result.message || 'Optimization failed with error', result });
    }

    // Persist any refitted analyses into design.analyses
    if (result.refittedAnalyses) {
      design.analyses = { ...(design.analyses || {}), ...result.refittedAnalyses };
      // Also update root analysis map if present
      if (projectData.analysis) {
        projectData.analysis = { ...projectData.analysis, ...result.refittedAnalyses };
      }
    }

    // Persist results into project.data
    if (!design.optimization) {
      design.optimization = {};
    }
    design.optimization.results = result;
    design.optimization.lastUpdated = new Date().toISOString();

    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        data: projectData,
        version: { increment: 1 },
      },
    });

    res.json({
      project: updatedProject,
      result,
    });
  } catch (error: any) {
    console.error('Error running optimization:', error);
    res.status(500).json({ error: error.message || 'Failed to run numerical optimization' });
  }
});

export default router;
