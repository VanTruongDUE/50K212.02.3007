import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';

type Input = { name?: unknown; subject?: unknown; body?: unknown };

@Controller('api/email-templates')
@UseGuards(SessionGuard)
export class TemplatesController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list() {
    return (
      await this.database.query(
        'SELECT id,name,subject,body,owner_id,created_at FROM email_templates ORDER BY created_at DESC LIMIT 100',
      )
    ).rows;
  }

  @Post()
  @Roles('employee')
  async create(@Body() body: Input, @Req() request: AuthenticatedRequest) {
    const data = this.validate(body);
    return (
      await this.database.query(
        'INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,$4) RETURNING *',
        [data.name, data.subject, data.body, request.account.id],
      )
    ).rows[0];
  }

  @Patch(':id')
  @Roles('employee')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Input,
    @Req() request: AuthenticatedRequest,
  ) {
    const current = await this.database.query(
      'SELECT * FROM email_templates WHERE id=$1 AND owner_id=$2',
      [id, request.account.id],
    );
    if (!current.rows[0]) throw new NotFoundException();
    const data = this.validate({ ...current.rows[0], ...body });
    return (
      await this.database.query(
        'UPDATE email_templates SET name=$2,subject=$3,body=$4 WHERE id=$1 RETURNING *',
        [id, data.name, data.subject, data.body],
      )
    ).rows[0];
  }

  @Delete(':id')
  @Roles('employee')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.database.query(
      'DELETE FROM email_templates WHERE id=$1 AND owner_id=$2 RETURNING id',
      [id, request.account.id],
    );
    if (!result.rowCount) throw new NotFoundException();
    return { deleted: true };
  }

  private validate(body: Input): {
    name: string;
    subject: string;
    body: string;
  } {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const subject =
      typeof body?.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (
      !name ||
      name.length > 100 ||
      !subject ||
      subject.length > 150 ||
      !content ||
      content.length > 100000
    )
      throw new BadRequestException('Mẫu email không hợp lệ.');
    return { name, subject, body: content };
  }
}
