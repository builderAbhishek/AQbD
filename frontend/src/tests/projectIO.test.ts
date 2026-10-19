import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  createAqbdEnvelope,
  parseAndValidateAqbdFile,
  generateCopyName,
} from '../lib/projectIO';

describe('Project Import/Export (.aqbd)', () => {
  describe('sanitizeFileName', () => {
    it('preserves clean names', () => {
      expect(sanitizeFileName('FormulationOptimization')).toBe('FormulationOptimization');
      expect(sanitizeFileName('Project 123')).toBe('Project 123');
    });

    it('replaces illegal characters with underscores', () => {
      expect(sanitizeFileName('Project: <Run 1> / "Test" * ? | \\')).toBe('Project_ _Run 1_ _ _Test_ _ _ _ _');
    });

    it('falls back to default for empty string or invalid input', () => {
      expect(sanitizeFileName('')).toBe('Project');
      expect(sanitizeFileName('   ')).toBe('Project');
    });

    it('strips trailing spaces and periods', () => {
      expect(sanitizeFileName('My Project... ')).toBe('My Project');
    });
  });

  describe('createAqbdEnvelope', () => {
    it('creates a standard .aqbd payload envelope', () => {
      const mockProject = {
        id: 'proj-123',
        name: 'Extraction Study',
        status: 'Active',
        version: 2,
        data: {
          designs: {
            d1: {
              id: 'd1',
              name: 'Central Composite',
              config: { factors: [{ id: '1', name: 'Temp' }] },
              runs: [{ id: 'r1', responses: { y1: 42 } }],
              optimization: { criteria: {}, results: {} },
            },
          },
        },
      };

      const envelope = createAqbdEnvelope(mockProject);
      expect(envelope.format).toBe('AQBD_PROJECT');
      expect(envelope.version).toBe('1.0.0');
      expect(envelope.appVersion).toBe('1.0.0');
      expect(envelope.exportTimestamp).toBeDefined();
      expect(envelope.project.name).toBe('Extraction Study');
      expect(envelope.project.data.designs.d1.runs[0].responses.y1).toBe(42);
    });
  });

  describe('parseAndValidateAqbdFile', () => {
    it('validates and parses a valid .aqbd file', () => {
      const validPayload = JSON.stringify({
        format: 'AQBD_PROJECT',
        version: '1.0.0',
        exportTimestamp: '2026-10-14T12:00:00.000Z',
        appVersion: '1.0.0',
        project: {
          id: 'test-uuid',
          name: 'Dissolution Study',
          status: 'Active',
          data: {
            designs: {
              design_1: {
                id: 'design_1',
                name: 'CCD 1',
                runs: [],
              },
            },
          },
        },
      });

      const result = parseAndValidateAqbdFile(validPayload);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.projectData.name).toBe('Dissolution Study');
        expect(result.projectData.originalId).toBe('test-uuid');
        expect(result.projectData.data.designs.design_1.name).toBe('CCD 1');
      }
    });

    it('rejects invalid JSON syntax', () => {
      const result = parseAndValidateAqbdFile('{ format: "AQBD_PROJECT", unclosed');
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toContain('Invalid JSON format');
      }
    });

    it('rejects unsupported format identifier', () => {
      const invalid = JSON.stringify({
        format: 'OTHER_PROJECT',
        version: '1.0.0',
        project: { name: 'Test', data: {} },
      });
      const result = parseAndValidateAqbdFile(invalid);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toContain('Unsupported format "OTHER_PROJECT"');
      }
    });

    it('rejects incompatible future major versions', () => {
      const future = JSON.stringify({
        format: 'AQBD_PROJECT',
        version: '2.5.0',
        project: { name: 'Future Project', data: {} },
      });
      const result = parseAndValidateAqbdFile(future);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toContain('Unsupported file version "2.5.0"');
      }
    });

    it('rejects missing project section', () => {
      const missing = JSON.stringify({
        format: 'AQBD_PROJECT',
        version: '1.0.0',
      });
      const result = parseAndValidateAqbdFile(missing);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.error).toContain('missing "project" section');
      }
    });

    it('sanitizes prototype pollution attempts', () => {
      const malicious = JSON.stringify({
        format: 'AQBD_PROJECT',
        version: '1.0.0',
        project: {
          name: 'Hacked',
          data: {
            designs: {},
            __proto__: { polluted: true },
          },
        },
      });

      const result = parseAndValidateAqbdFile(malicious);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(Object.prototype.hasOwnProperty.call(result.projectData.data, '__proto__')).toBe(false);
      }
    });

    it('supports backward-compatible legacy project exports', () => {
      const legacy = JSON.stringify({
        name: 'Legacy Project',
        data: {
          designs: {
            d1: { id: 'd1', name: 'Old Design' },
          },
        },
      });

      const result = parseAndValidateAqbdFile(legacy);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.projectData.name).toBe('Legacy Project');
        expect(result.projectData.data.designs.d1.name).toBe('Old Design');
      }
    });
  });

  describe('generateCopyName', () => {
    it('creates (Copy) when name exists', () => {
      expect(generateCopyName('Yield Study', ['Yield Study'])).toBe('Yield Study (Copy)');
    });

    it('creates incremental copy numbers if (Copy) already exists', () => {
      expect(
        generateCopyName('Yield Study', ['Yield Study', 'Yield Study (Copy)'])
      ).toBe('Yield Study (Copy 2)');

      expect(
        generateCopyName('Yield Study', [
          'Yield Study',
          'Yield Study (Copy)',
          'Yield Study (Copy 2)',
        ])
      ).toBe('Yield Study (Copy 3)');
    });

    it('performs case-insensitive duplicate checks', () => {
      expect(
        generateCopyName('yield study', ['Yield Study', 'YIELD STUDY (COPY)'])
      ).toBe('yield study (Copy 2)');
    });
  });
});
