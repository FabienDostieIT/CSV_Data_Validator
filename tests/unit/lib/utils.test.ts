import { cn } from '../../../lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4'); // tailwind-merge keeps the last
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles empty and undefined values', () => {
    expect(cn('foo', undefined, '', null, 'bar')).toBe('foo bar');
  });
});
