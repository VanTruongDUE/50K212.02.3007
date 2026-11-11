import { afterBusinessDays } from './business-days';

describe('afterBusinessDays', () => {
  it('skips weekend and schedules at 09:00 Vietnam time', () => {
    expect(
      afterBusinessDays(new Date('2026-11-13T03:00:00Z'), 2).toISOString(),
    ).toBe('2026-11-17T02:00:00.000Z');
  });
});
