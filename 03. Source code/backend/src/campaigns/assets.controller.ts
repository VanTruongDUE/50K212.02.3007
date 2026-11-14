import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { basename } from 'node:path';
import type { Response } from 'express';
import type { QueryResultRow } from 'pg';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';

@Controller('api/campaigns/:campaignId/assets')
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(
    @Param('campaignId', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.campaign(id, request);
    return (
      await this.database.query(
        'SELECT id,kind,file_name,content_type,size_bytes,created_at FROM campaign_assets WHERE campaign_id=$1 ORDER BY id',
        [id],
      )
    ).rows;
  }

  @Get(':assetId')
  async download(
    @Param('campaignId', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    await this.campaign(id, request);
    const result = await this.database.query<
      {
        content: Buffer;
        content_type: string;
        file_name: string;
      } & QueryResultRow
    >(
      'SELECT content,content_type,file_name FROM campaign_assets WHERE campaign_id=$1 AND id=$2',
      [id, assetId],
    );
    if (!result.rows[0]) throw new NotFoundException();
    response.setHeader('Content-Type', result.rows[0].content_type);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `${['image/png', 'image/jpeg'].includes(result.rows[0].content_type) ? 'inline' : 'attachment'}; filename="asset-${assetId}"`,
    );
    response.send(result.rows[0].content);
  }

  @Post()
  @Roles('employee')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_000_000, files: 1 } }),
  )
  async upload(
    @Param('campaignId', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
    @Body() body: { kind?: unknown },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (
      !file?.buffer ||
      !file.size ||
      file.size > 10_000_000 ||
      !['logo', 'pdf', 'image'].includes(String(body?.kind))
    )
      throw new BadRequestException('Tệp email không hợp lệ.');
    const kind = body.kind;
    const bytes = file.buffer;
    let contentType: string;
    if (kind === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-')
      contentType = 'application/pdf';
    else if (
      (kind === 'logo' || kind === 'image') &&
      file.size <= 2_000_000 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      contentType = 'image/png';
    else if (
      (kind === 'logo' || kind === 'image') &&
      file.size <= 2_000_000 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    )
      contentType = 'image/jpeg';
    else if (
      kind === 'logo' &&
      file.size <= 2_000_000 &&
      /<svg[\s>]/i.test(bytes.subarray(0, 500).toString('utf8'))
    )
      contentType = 'image/svg+xml';
    else
      throw new BadRequestException(
        'Ảnh phải là PNG/JPG tối đa 2 MB, logo có thể là SVG; PDF tối đa 10 MB.',
      );
    const name = basename(file.originalname).slice(0, 255) || 'attachment';
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const campaign = await client.query<
        { owner_id: string; status: string } & QueryResultRow
      >('SELECT owner_id,status FROM campaigns WHERE id=$1 FOR UPDATE', [id]);
      if (!campaign.rows[0] || campaign.rows[0].owner_id !== request.account.id)
        throw new NotFoundException();
      if (!['approved', 'paused'].includes(campaign.rows[0].status))
        throw new ConflictException(
          'Chỉ sửa tệp khi chiến dịch đang chuẩn bị hoặc tạm dừng.',
        );
      if (kind === 'pdf') {
        const count = await client.query<{ count: string }>(
          "SELECT count(*) FROM campaign_assets WHERE campaign_id=$1 AND kind='pdf'",
          [id],
        );
        if (Number(count.rows[0].count) >= 3)
          throw new ConflictException(
            'Mỗi chiến dịch chỉ có tối đa 3 tệp PDF.',
          );
      } else if (kind === 'logo')
        await client.query(
          "DELETE FROM campaign_assets WHERE campaign_id=$1 AND kind='logo'",
          [id],
        );
      const saved = await client.query<QueryResultRow>(
        'INSERT INTO campaign_assets(campaign_id,kind,file_name,content_type,content,size_bytes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,kind,file_name,content_type,size_bytes',
        [id, kind, name, contentType, bytes, file.size],
      );
      await client.query(
        'UPDATE campaigns SET previewed_at=NULL,updated_at=now() WHERE id=$1',
        [id],
      );
      await client.query('COMMIT');
      return saved.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Delete(':assetId')
  @Roles('employee')
  async remove(
    @Param('campaignId', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.campaign(id, request);
    if (campaign.owner_id !== request.account.id) throw new NotFoundException();
    if (!['approved', 'paused'].includes(campaign.status))
      throw new ConflictException('Chiến dịch đã xác nhận không thể sửa tệp.');
    const asset = await this.database.query<
      { kind: string; body: string | null } & QueryResultRow
    >(
      'SELECT a.kind,c.body FROM campaign_assets a JOIN campaigns c ON c.id=a.campaign_id WHERE a.campaign_id=$1 AND a.id=$2',
      [id, assetId],
    );
    if (
      asset.rows[0]?.kind === 'image' &&
      asset.rows[0].body?.includes(`[[Hình ảnh:${assetId}]]`)
    )
      throw new ConflictException(
        'Hãy xóa ảnh khỏi nội dung email rồi lưu trước khi xóa tệp.',
      );
    const result = await this.database.query(
      'DELETE FROM campaign_assets WHERE campaign_id=$1 AND id=$2 RETURNING id',
      [id, assetId],
    );
    if (!result.rowCount) throw new NotFoundException();
    await this.database.query(
      'UPDATE campaigns SET previewed_at=NULL,updated_at=now() WHERE id=$1',
      [id],
    );
    return { deleted: true };
  }

  private async campaign(id: number, request: AuthenticatedRequest) {
    const result = await this.database.query<
      { owner_id: string; status: string } & QueryResultRow
    >(
      "SELECT owner_id,status FROM campaigns WHERE id=$1 AND ($2='manager' OR owner_id=$3)",
      [id, request.account.role, request.account.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
