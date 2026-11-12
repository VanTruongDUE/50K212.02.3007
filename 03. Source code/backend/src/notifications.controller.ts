import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Roles } from './auth/roles';
import { SessionGuard } from './auth/session.guard';
import type { AuthenticatedRequest } from './auth/session.guard';
import { DatabaseService } from './database/database.service';

@Controller('api/notifications')
@UseGuards(SessionGuard)
@Roles('employee', 'manager')
export class NotificationsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result =
      request.account.role === 'manager'
        ? await this.database.query(`
          SELECT 'contact_list_review' AS type,id::text,name AS title,created_at FROM contact_lists WHERE confirmed_at IS NOT NULL AND manager_review='pending'
          UNION ALL SELECT 'paused_campaign',id::text,name,updated_at FROM campaigns WHERE status='paused'
          UNION ALL SELECT 'blocked_sender',id::text,name,created_at FROM sender_accounts WHERE status='blocked'
          ORDER BY created_at DESC LIMIT 100`)
        : await this.database.query(
            `
          SELECT 'due_followup' AS type,f.id::text,r.customer_name AS title,f.due_at AS created_at FROM followups f JOIN responses r ON r.id=f.response_id WHERE f.assignee_id=$1 AND f.status='pending' AND f.due_at-(f.reminder_minutes * interval '1 minute')<=now()
          UNION ALL SELECT 'new_response',id::text,customer_name,received_at FROM responses WHERE assignee_id=$1 AND status='new' AND hidden_at IS NULL
          UNION ALL SELECT 'paused_campaign',id::text,name,updated_at FROM campaigns WHERE owner_id=$1 AND status='paused'
          ORDER BY created_at DESC LIMIT 100`,
            [request.account.id],
          );
    return result.rows;
  }
}
