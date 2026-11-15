import { DeliveryWorker } from './campaigns/delivery.worker';
import { FollowupWorker } from './followups/followup.worker';
import { InboxService } from './inbox/inbox.service';
import { SearchService } from './search/search.service';

describe('Serverless worker lifecycle', () => {
  const original = process.env.VERCEL;
  afterEach(() => {
    if (original === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original;
    jest.restoreAllMocks();
  });

  it.each([DeliveryWorker, FollowupWorker, InboxService, SearchService])(
    '%s does not start timers or run recovery on Vercel',
    (Worker) => {
      process.env.VERCEL = '1';
      const timer = jest.spyOn(global, 'setInterval');
      const worker = Object.create(Worker.prototype) as {
        onModuleInit(): void;
      };
      // Missing dependencies intentionally make any startup query fail the check.
      expect(() => worker.onModuleInit()).not.toThrow();
      expect(timer).not.toHaveBeenCalled();
    },
  );

  it.each([FollowupWorker, InboxService, SearchService])(
    '%s retains the local interval',
    (Worker) => {
      delete process.env.VERCEL;
      const timer = jest
        .spyOn(global, 'setInterval')
        .mockReturnValue({} as NodeJS.Timeout);
      const worker = Object.create(Worker.prototype) as {
        onModuleInit(): void;
      };
      worker.onModuleInit();
      expect(timer).toHaveBeenCalledTimes(1);
    },
  );
});
