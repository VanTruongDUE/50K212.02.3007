import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { GoogleMailService } from './google-mail.service';

@Controller('api/sender-accounts')
@UseGuards(SessionGuard)
@Roles('manager')
export class GoogleMailController {
  constructor(private readonly google: GoogleMailService) {}

  @Get('google/status')
  status() {
    return this.google.available();
  }

  @Post(':id/google/connect')
  start(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.google.start(id, String(request.cookies.v5_session));
  }

  @Post(':id/google/disconnect')
  disconnect(@Param('id', ParseIntPipe) id: number) {
    return this.google.disconnect(id);
  }

  @Get('google/callback')
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    let target: string;
    try {
      const result = await this.google.complete(
        typeof query.state === 'string' ? query.state : '',
        typeof query.code === 'string' ? query.code : '',
        typeof query.error === 'string',
        String(request.cookies.v5_session),
      );
      target = this.google.returnUrl(result.result, result.id);
    } catch {
      target = this.google.returnUrl('expired');
    }
    response.redirect(303, target);
  }
}
