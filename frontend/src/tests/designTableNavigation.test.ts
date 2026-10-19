import { describe, it, expect } from 'vitest';
import {
  parseResponseValue,
  getTargetCell,
  shouldNavigate,
} from '../components/views/DesignTable';

describe('DesignTable - Response Cell Editing & Navigation', () => {
  describe('parseResponseValue', () => {
    it('parses valid integer values like 1, 3, 4', () => {
      expect(parseResponseValue('1')).toBe(1);
      expect(parseResponseValue('3')).toBe(3);
      expect(parseResponseValue('4')).toBe(4);
    });

    it('parses decimal and negative values', () => {
      expect(parseResponseValue('12.345')).toBe(12.345);
      expect(parseResponseValue('-0.75')).toBe(-0.75);
    });

    it('converts empty strings and whitespace to null (empty cell behavior)', () => {
      expect(parseResponseValue('')).toBeNull();
      expect(parseResponseValue('   ')).toBeNull();
    });

    it('converts non-numeric input to null', () => {
      expect(parseResponseValue('abc')).toBeNull();
      expect(parseResponseValue('N/A')).toBeNull();
    });
  });

  describe('getTargetCell (Single response column)', () => {
    const responseKeys = ['resp_1'];
    const totalRows = 5;

    it('Arrow Down: moves to cell directly below in the same response column', () => {
      const target = getTargetCell('down', 0, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Down: clamps at bottom row', () => {
      const target = getTargetCell('down', 4, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 4, col: 'resp_1' });
    });

    it('Arrow Up: moves to cell directly above in the same response column', () => {
      const target = getTargetCell('up', 2, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Up: clamps at top row', () => {
      const target = getTargetCell('up', 0, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 0, col: 'resp_1' });
    });

    it('Arrow Right: moves to next row cell when single column', () => {
      const target = getTargetCell('right', 0, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Left: moves to previous row cell when single column', () => {
      const target = getTargetCell('left', 2, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Left: clamps at first cell', () => {
      const target = getTargetCell('left', 0, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 0, col: 'resp_1' });
    });
  });

  describe('getTargetCell (Multiple response columns)', () => {
    const responseKeys = ['resp_1', 'resp_2', 'resp_3'];
    const totalRows = 3;

    it('Arrow Down: always stays in the same response column', () => {
      const target = getTargetCell('down', 0, 'resp_2', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_2' });
    });

    it('Arrow Up: always stays in the same response column', () => {
      const target = getTargetCell('up', 2, 'resp_3', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_3' });
    });

    it('Arrow Right: moves to the next column within the same row', () => {
      const target = getTargetCell('right', 0, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 0, col: 'resp_2' });
    });

    it('Arrow Right: wraps to next row and first column at end of row', () => {
      const target = getTargetCell('right', 0, 'resp_3', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Left: moves to previous column within the same row', () => {
      const target = getTargetCell('left', 1, 'resp_2', totalRows, responseKeys);
      expect(target).toEqual({ row: 1, col: 'resp_1' });
    });

    it('Arrow Left: wraps to previous row and last column at start of row', () => {
      const target = getTargetCell('left', 1, 'resp_1', totalRows, responseKeys);
      expect(target).toEqual({ row: 0, col: 'resp_3' });
    });

    it('clamps at boundaries', () => {
      expect(getTargetCell('left', 0, 'resp_1', totalRows, responseKeys)).toEqual({ row: 0, col: 'resp_1' });
      expect(getTargetCell('up', 0, 'resp_2', totalRows, responseKeys)).toEqual({ row: 0, col: 'resp_2' });
      expect(getTargetCell('right', 2, 'resp_3', totalRows, responseKeys)).toEqual({ row: 2, col: 'resp_3' });
      expect(getTargetCell('down', 2, 'resp_2', totalRows, responseKeys)).toEqual({ row: 2, col: 'resp_2' });
    });
  });

  describe('shouldNavigate', () => {
    it('ArrowDown and ArrowUp always trigger navigation', () => {
      expect(shouldNavigate('ArrowDown', { selectionStart: 1, selectionEnd: 1, value: '123' })).toBe(true);
      expect(shouldNavigate('ArrowUp', { selectionStart: 2, selectionEnd: 2, value: '123' })).toBe(true);
    });

    it('ArrowLeft triggers navigation when all text is selected', () => {
      expect(shouldNavigate('ArrowLeft', { selectionStart: 0, selectionEnd: 3, value: '123' })).toBe(true);
    });

    it('ArrowLeft triggers navigation when cursor is at the very beginning (position 0)', () => {
      expect(shouldNavigate('ArrowLeft', { selectionStart: 0, selectionEnd: 0, value: '123' })).toBe(true);
    });

    it('ArrowLeft preserves normal text editing when cursor is inside the text', () => {
      expect(shouldNavigate('ArrowLeft', { selectionStart: 1, selectionEnd: 1, value: '123' })).toBe(false);
      expect(shouldNavigate('ArrowLeft', { selectionStart: 2, selectionEnd: 2, value: '123' })).toBe(false);
      expect(shouldNavigate('ArrowLeft', { selectionStart: 3, selectionEnd: 3, value: '123' })).toBe(false);
    });

    it('ArrowRight triggers navigation when all text is selected', () => {
      expect(shouldNavigate('ArrowRight', { selectionStart: 0, selectionEnd: 3, value: '123' })).toBe(true);
    });

    it('ArrowRight triggers navigation when cursor is at the very end of text', () => {
      expect(shouldNavigate('ArrowRight', { selectionStart: 3, selectionEnd: 3, value: '123' })).toBe(true);
    });

    it('ArrowRight preserves normal text editing when cursor is inside the text', () => {
      expect(shouldNavigate('ArrowRight', { selectionStart: 0, selectionEnd: 0, value: '123' })).toBe(false);
      expect(shouldNavigate('ArrowRight', { selectionStart: 1, selectionEnd: 1, value: '123' })).toBe(false);
      expect(shouldNavigate('ArrowRight', { selectionStart: 2, selectionEnd: 2, value: '123' })).toBe(false);
    });

    it('Both ArrowLeft and ArrowRight trigger navigation immediately on empty cell', () => {
      expect(shouldNavigate('ArrowLeft', { selectionStart: 0, selectionEnd: 0, value: '' })).toBe(true);
      expect(shouldNavigate('ArrowRight', { selectionStart: 0, selectionEnd: 0, value: '' })).toBe(true);
    });
  });
});
