import { getPictogramUrl } from '../services/arasaacService';

describe('getPictogramUrl', () => {
  it('generates a URL with default resolution 300', () => {
    const url = getPictogramUrl(12345);
    expect(url).toBe('https://static.arasaac.org/pictograms/12345/12345_300.png');
  });

  it('generates a URL with custom resolution', () => {
    const url = getPictogramUrl(999, 500);
    expect(url).toBe('https://static.arasaac.org/pictograms/999/999_500.png');
  });

  it('handles string IDs', () => {
    const url = getPictogramUrl('42', 2500);
    expect(url).toBe('https://static.arasaac.org/pictograms/42/42_2500.png');
  });
});
