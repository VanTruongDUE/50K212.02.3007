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
import { parseCampaignBody } from '../campaigns/content-blocks';
import type { PoolClient } from 'pg';

type Input = {
  name?: unknown;
  subject?: unknown;
  body?: unknown;
  campaignId?: unknown;
};

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
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const saved = (
        await client.query<{
          id: string;
          name: string;
          subject: string;
          body: string;
          owner_id: string;
        }>(
          'INSERT INTO email_templates(name,subject,body,owner_id) VALUES($1,$2,$3,$4) RETURNING *',
          [data.name, data.subject, data.body, request.account.id],
        )
      ).rows[0];
      await this.copyImagesToTemplate(
        client,
        saved.id,
        data.body,
        body.campaignId,
        request.account.id,
      );
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const saved = (
        await client.query<{
          id: string;
          name: string;
          subject: string;
          body: string;
          owner_id: string;
        }>(
          'UPDATE email_templates SET name=$2,subject=$3,body=$4 WHERE id=$1 RETURNING *',
          [id, data.name, data.subject, data.body],
        )
      ).rows[0];
      if (data.body !== current.rows[0].body) {
        await client.query(
          'DELETE FROM email_template_images WHERE template_id=$1',
          [id],
        );
        await this.copyImagesToTemplate(
          client,
          id,
          data.body,
          body.campaignId,
          request.account.id,
        );
      }
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Post(':id/apply')
  @Roles('employee')
  async apply(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { campaignId?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const campaignId = Number(body?.campaignId);
    if (!Number.isSafeInteger(campaignId) || campaignId < 1)
      throw new BadRequestException('Chiến dịch không hợp lệ.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const campaign = await client.query(
        "SELECT id FROM campaigns WHERE id=$1 AND owner_id=$2 AND status IN ('approved','paused') FOR UPDATE",
        [campaignId, request.account.id],
      );
      if (!campaign.rowCount) throw new NotFoundException();
      const template = (
        await client.query<{ subject: string; body: string }>(
          'SELECT subject,body FROM email_templates WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!template) throw new NotFoundException();
      const ids = [
        ...new Set(
          parseCampaignBody(template.body)
            .filter((block) => block.kind === 'image')
            .map((block) => block.id),
        ),
      ];
      let content = template.body;
      for (const sourceId of ids) {
        const saved = await client.query<{ id: string }>(
          `INSERT INTO campaign_assets(campaign_id,kind,file_name,content_type,content,size_bytes)
           SELECT $1,'image',file_name,content_type,content,size_bytes FROM email_template_images WHERE template_id=$2 AND source_asset_id=$3 RETURNING id`,
          [campaignId, id, sourceId],
        );
        if (!saved.rowCount)
          throw new BadRequestException('Ảnh của mẫu email không còn tồn tại.');
        content = content.replaceAll(
          `[[Hình ảnh:${sourceId}]]`,
          `[[Hình ảnh:${saved.rows[0].id}]]`,
        );
      }
      await client.query('COMMIT');
      return { subject: template.subject, body: content };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async copyImagesToTemplate(
    client: PoolClient,
    templateId: string | number,
    content: string,
    campaignIdValue: unknown,
    ownerId: string,
  ) {
    const ids = [
      ...new Set(
        parseCampaignBody(content)
          .filter((block) => block.kind === 'image')
          .map((block) => block.id),
      ),
    ];
    if (!ids.length) return;
    const campaignId = Number(campaignIdValue);
    if (!Number.isSafeInteger(campaignId) || campaignId < 1)
      throw new BadRequestException(
        'Cần chọn chiến dịch chứa ảnh của mẫu email.',
      );
    const owned = await client.query(
      'SELECT id FROM campaigns WHERE id=$1 AND owner_id=$2',
      [campaignId, ownerId],
    );
    if (!owned.rowCount) throw new NotFoundException();
    const copied = await client.query(
      `INSERT INTO email_template_images(template_id,source_asset_id,file_name,content_type,content,size_bytes)
       SELECT $1,id,file_name,content_type,content,size_bytes FROM campaign_assets WHERE campaign_id=$2 AND kind='image' AND id=ANY($3::bigint[])`,
      [templateId, campaignId, ids],
    );
    if (copied.rowCount !== ids.length)
      throw new BadRequestException(
        'Ảnh của mẫu email không thuộc chiến dịch hiện tại.',
      );
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
    parseCampaignBody(content);
    return { name, subject, body: content };
  }
}
