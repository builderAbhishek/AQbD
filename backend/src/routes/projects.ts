import { Router, Request, Response } from 'express';
import prisma from '../prisma';

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

// GET /api/v1/projects/:id/export
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.setHeader('Content-disposition', `attachment; filename=aqbd_${project.id}.json`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(project, null, 2));
  } catch (error) {
    console.error('Error exporting project:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

// POST /api/v1/projects/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { name, data, status } = req.body;
    
    const importedProject = await prisma.project.create({
      data: {
        name: name || 'Imported Project',
        data: data || {},
        status: status || 'IMPORTED',
      },
    });
    
    res.status(201).json(importedProject);
  } catch (error) {
    console.error('Error importing project:', error);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

export default router;
