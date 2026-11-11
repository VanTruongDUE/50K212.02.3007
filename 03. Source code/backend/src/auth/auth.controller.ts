import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

type LoginBody = { email?: unknown; password?: unknown };
const cookieName = 'v5_session';
const cookiePath = '/api';
const sessionToken = (request: Request): string | undefined => {
  const token: unknown = request.cookies?.[cookieName];
  return typeof token === 'string' ? token : undefined;
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ) {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const errors: Record<string, string> = {};
    if (!email) errors.email = 'Vui lòng nhập email.';
    else if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = 'Email không đúng định dạng. Vui lòng kiểm tra lại.';
    if (!password) errors.password = 'Vui lòng nhập mật khẩu.';
    else if (password.length > 1024) errors.password = 'Mật khẩu không hợp lệ.';
    if (Object.keys(errors).length)
      throw new BadRequestException({ code: 'VALIDATION_ERROR', errors });

    const { token, account } = await this.auth.login(email, password);
    response.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: cookiePath,
      maxAge: 8 * 60 * 60 * 1000,
    });
    return account;
  }

  @Get('me')
  async me(@Req() request: Request) {
    const account = await this.auth.current(sessionToken(request));
    if (!account) throw new UnauthorizedException();
    return account;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(sessionToken(request));
    response.clearCookie(cookieName, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: cookiePath,
    });
  }
}
