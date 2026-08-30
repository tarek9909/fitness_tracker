/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  parseStrictInteger,
  parsePositiveInteger,
  parseStrictFloat,
  parseBoundedInteger,
  parseBoundedFloat,
} from './number-utils';

describe('Admin Dashboard Number Utilities Suite', () => {
  describe('parseStrictInteger', () => {
    it('returns null for null, undefined, empty string, and whitespace', () => {
      expect(parseStrictInteger(null)).toBeNull();
      expect(parseStrictInteger(undefined)).toBeNull();
      expect(parseStrictInteger('')).toBeNull();
      expect(parseStrictInteger('   ')).toBeNull();
    });

    it('returns null for non-integer strings and malformed input', () => {
      expect(parseStrictInteger('abc')).toBeNull();
      expect(parseStrictInteger('12a')).toBeNull();
      expect(parseStrictInteger('12.34')).toBeNull();
      expect(parseStrictInteger('NaN')).toBeNull();
      expect(parseStrictInteger('Infinity')).toBeNull();
      expect(parseStrictInteger({})).toBeNull();
    });

    it('parses valid integer strings and numbers', () => {
      expect(parseStrictInteger('0')).toBe(0);
      expect(parseStrictInteger('42')).toBe(42);
      expect(parseStrictInteger('+42')).toBe(42);
      expect(parseStrictInteger('-15')).toBe(-15);
      expect(parseStrictInteger(100)).toBe(100);
    });

    it('enforces min and max bounds when specified', () => {
      expect(parseStrictInteger('5', { min: 10 })).toBeNull();
      expect(parseStrictInteger('15', { min: 10 })).toBe(15);
      expect(parseStrictInteger('50', { max: 20 })).toBeNull();
      expect(parseStrictInteger('20', { max: 20 })).toBe(20);
    });
  });

  describe('parsePositiveInteger', () => {
    it('returns null for 0, negative values, and non-numeric input', () => {
      expect(parsePositiveInteger('0')).toBeNull();
      expect(parsePositiveInteger('-1')).toBeNull();
      expect(parsePositiveInteger('abc')).toBeNull();
      expect(parsePositiveInteger(null)).toBeNull();
      expect(parsePositiveInteger('1.5')).toBeNull();
    });

    it('returns positive integer for valid inputs', () => {
      expect(parsePositiveInteger('1')).toBe(1);
      expect(parsePositiveInteger('42')).toBe(42);
      expect(parsePositiveInteger(100)).toBe(100);
    });
  });

  describe('parseStrictFloat', () => {
    it('returns null for null, undefined, empty string, and whitespace', () => {
      expect(parseStrictFloat(null)).toBeNull();
      expect(parseStrictFloat(undefined)).toBeNull();
      expect(parseStrictFloat('')).toBeNull();
      expect(parseStrictFloat('   ')).toBeNull();
    });

    it('strictly rejects partial input like 12abc, non-numeric strings, and non-finite values', () => {
      expect(parseStrictFloat('12abc')).toBeNull();
      expect(parseStrictFloat('abc12')).toBeNull();
      expect(parseStrictFloat('12.3.4')).toBeNull();
      expect(parseStrictFloat('NaN')).toBeNull();
      expect(parseStrictFloat('Infinity')).toBeNull();
      expect(parseStrictFloat('-Infinity')).toBeNull();
      expect(parseStrictFloat('0x12')).toBeNull();
    });

    it('parses valid decimal floats and scientific notation', () => {
      expect(parseStrictFloat('0')).toBe(0);
      expect(parseStrictFloat('75.5')).toBe(75.5);
      expect(parseStrictFloat('-12.25')).toBe(-12.25);
      expect(parseStrictFloat('.5')).toBe(0.5);
      expect(parseStrictFloat('12.')).toBe(12);
      expect(parseStrictFloat('1.5e2')).toBe(150);
    });

    it('enforces min and max bounds on floats', () => {
      expect(parseStrictFloat('15.5', { min: 20 })).toBeNull();
      expect(parseStrictFloat('25.5', { min: 20 })).toBe(25.5);
      expect(parseStrictFloat('105.0', { max: 100 })).toBeNull();
      expect(parseStrictFloat('99.5', { max: 100 })).toBe(99.5);
    });
  });

  describe('parseBoundedInteger', () => {
    it('returns fallback on null, undefined, empty, or malformed input without producing NaN', () => {
      expect(parseBoundedInteger(null, { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger(undefined, { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger('', { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger('   ', { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger('abc', { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger('12abc', { min: 0, max: 100, fallback: 10 })).toBe(10);
      expect(parseBoundedInteger('NaN', { min: 0, max: 100, fallback: 10 })).toBe(10);
    });

    it('clamps values to min and max boundaries', () => {
      expect(parseBoundedInteger('-5', { min: 0, max: 100, fallback: 10 })).toBe(0);
      expect(parseBoundedInteger('150', { min: 0, max: 100, fallback: 10 })).toBe(100);
      expect(parseBoundedInteger('50', { min: 0, max: 100, fallback: 10 })).toBe(50);
    });
  });

  describe('parseBoundedFloat', () => {
    it('returns fallback on null, undefined, empty, or malformed input without producing NaN', () => {
      expect(parseBoundedFloat(null, { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat(undefined, { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('   ', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('abc', { min: 20, max: 300, fallback: 70 })).toBe(70);
    });

    it('returns fallback for partial input like 12abc and non-finite values (NaN, Infinity)', () => {
      expect(parseBoundedFloat('12abc', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('abc12', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('12.3.4', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('NaN', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('Infinity', { min: 20, max: 300, fallback: 70 })).toBe(70);
      expect(parseBoundedFloat('-Infinity', { min: 20, max: 300, fallback: 70 })).toBe(70);
    });

    it('parses valid floating-point numbers and HTML number formats accurately', () => {
      expect(parseBoundedFloat('75.5', { min: 20, max: 300, fallback: 70 })).toBe(75.5);
      expect(parseBoundedFloat('80.25', { min: 20, max: 300, fallback: 70 })).toBe(80.25);
      expect(parseBoundedFloat('.5', { min: 0, max: 10, fallback: 5 })).toBe(0.5);
      expect(parseBoundedFloat('12.', { min: 0, max: 100, fallback: 5 })).toBe(12);
      expect(parseBoundedFloat('-5.5', { min: -10, max: 10, fallback: 0 })).toBe(-5.5);
    });

    it('clamps floats to min and max boundaries', () => {
      expect(parseBoundedFloat('10.5', { min: 20, max: 300, fallback: 70 })).toBe(20);
      expect(parseBoundedFloat('400.9', { min: 20, max: 300, fallback: 70 })).toBe(300);
    });
  });
});
