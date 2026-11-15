import { DatabaseService } from '../database/database.service';
import { SendersController } from './senders.controller';
import { SmtpService } from './smtp.service';

describe('SendersController SMTP verification', () => {
  it.each([
    ['EAUTH', 'từ chối xác thực SMTP'],
    ['ETIMEDOUT', 'Không thể kết nối'],
  ])('reports %s without exposing provider details', async (code, message) => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '164' }] }),
    } as unknown as DatabaseService;
    const smtp = {
      verify: jest.fn().mockRejectedValue({
        code,
        response: 'private-provider-details',
      }),
    } as unknown as SmtpService;
    const controller = new SendersController(database, smtp);
    await expect(controller.verify(164)).rejects.toThrow(message);
    await expect(controller.verify(164)).rejects.not.toThrow(
      'private-provider-details',
    );
  });
});
