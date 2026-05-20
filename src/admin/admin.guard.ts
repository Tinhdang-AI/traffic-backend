import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
