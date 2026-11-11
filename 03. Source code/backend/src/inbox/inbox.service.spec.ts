import { classifyIncoming } from './inbox.service';

describe('classifyIncoming', () => {
  it('recognises explicit opt-out and auto reply without treating ordinary interest as opt-out', () => {
    expect(
      classifyIncoming(
        'buyer@example.com',
        'Re: webinar',
        'Please remove me from this list',
      ),
    ).toBe('unsubscribe');
    expect(
      classifyIncoming(
        'buyer@example.com',
        'Out of office',
        'I am away',
        'auto-replied',
      ),
    ).toBe('out_of_office');
    expect(
      classifyIncoming('buyer@example.com', 'Re: webinar', 'I am interested'),
    ).toBe('other');
  });
});
