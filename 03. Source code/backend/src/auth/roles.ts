import { SetMetadata } from '@nestjs/common';
import type { Account } from './auth.service';

export const Roles = (...roles: Array<Account['role']>) =>
  SetMetadata('roles', roles);
