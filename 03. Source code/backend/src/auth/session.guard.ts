import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService, type Account } from './auth.service';

export type AuthenticatedRequest = Request & { account: Account };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.v5_session;
    const account = await this.auth.current(
      typeof token === 'string' ? token : undefined,
    );
    if (!account) throw new UnauthorizedException();
    const roles = this.reflector.getAllAndOverride<Array<Account['role']>>(
      'roles',
      [context.getHandler(), context.getClass()],
    );
    if (roles && !roles.includes(account.role)) throw new ForbiddenException();
    request.account = account;
    return true;
  }
}
