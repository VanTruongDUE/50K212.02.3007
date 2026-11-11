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
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';

type Input = { name?: unknown; criteria?: unknown };
const selections = ['role', 'industry', 'location', 'size', 'email'];

@Controller('api/filter-templates')
@UseGuards(SessionGuard)
@Roles('employee')
export class FilterTemplatesController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return (
      await this.database.query(
        'SELECT * FROM filter_templates WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100',
        [request.account.id],
      )
    ).rows;
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.database.query(
      'SELECT * FROM filter_templates WHERE id=$1 AND owner_id=$2',
      [id, request.account.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  @Post()
  async create(@Body() body: Input, @Req() request: AuthenticatedRequest) {
    const data = this.validate(body);
    try {
      return (
        await this.database.query(
          'INSERT INTO filter_templates(owner_id,name,criteria) VALUES($1,$2,$3) RETURNING *',
          [request.account.id, data.name, JSON.stringify(data.criteria)],
        )
      ).rows[0];
    } catch (error) {
      this.unique(error);
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Input,
    @Req() request: AuthenticatedRequest,
  ) {
    const current = await this.detail(id, request);
    const data = this.validate({
      name: body?.name ?? current.name,
      criteria: body?.criteria ?? current.criteria,
    });
    try {
      return (
        await this.database.query(
          'UPDATE filter_templates SET name=$3,criteria=$4,updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *',
          [id, request.account.id, data.name, JSON.stringify(data.criteria)],
        )
      ).rows[0];
    } catch (error) {
      this.unique(error);
    }
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.database.query(
      'DELETE FROM filter_templates WHERE id=$1 AND owner_id=$2 RETURNING id',
      [id, request.account.id],
    );
    if (!result.rowCount) throw new NotFoundException();
    return { deleted: true };
  }

  private validate(body: Input): {
    name: string;
    criteria: Record<string, unknown>;
  } {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const criteria = body?.criteria;
    if (
      !name ||
      name.length > 100 ||
      !criteria ||
      typeof criteria !== 'object' ||
      Array.isArray(criteria)
    )
      throw new BadRequestException('Filter Template không hợp lệ.');
    const value = criteria as Record<string, unknown>;
    if (
      selections.some(
        (key) =>
          !Array.isArray(value[key]) ||
          !(value[key] as unknown[]).every(
            (item) =>
              typeof item === 'string' && item.trim() && item.length <= 100,
          ),
      ) ||
      typeof value.keyword !== 'string' ||
      value.keyword.length > 200 ||
      (value.source !== undefined &&
        (typeof value.source !== 'string' ||
          !['', 'Google Search/Web', 'Apollo'].includes(value.source)))
    )
      throw new BadRequestException('Tiêu chí không hợp lệ.');
    if (
      !selections.some((key) => (value[key] as unknown[]).length) &&
      !value.keyword.trim()
    )
      throw new BadRequestException('Cần ít nhất một tiêu chí.');
    return { name, criteria: value };
  }

  private unique(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    )
      throw new ConflictException('Tên Filter Template đã tồn tại.');
    throw error;
  }
}
