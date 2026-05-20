import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getDashboardStats() {
    try {
      const client = this.supabaseService.getAdminClient();

      const [
        { count: totalUsers },
        { count: totalReports },
        { count: verifiedReports },
        { count: historyRecords },
      ] = await Promise.all([
        client.from('profiles').select('id', { count: 'exact', head: true }),
        client.from('reports').select('id', { count: 'exact', head: true }),
        client.from('reports').select('id', { count: 'exact', head: true }).eq('is_verified', true),
        client.from('history').select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalUsers: totalUsers ?? 0,
        totalReports: totalReports ?? 0,
        verifiedReports: verifiedReports ?? 0,
        detectionHistory: historyRecords ?? 0,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
    }
  }

  async getAllReports(
    status?: string,
    violationType?: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    try {
      let query = this.supabaseService
        .getAdminClient()
        .from('reports')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status === 'verified') {
        query = query.eq('is_verified', true);
      } else if (status === 'rejected') {
        query = query.eq('is_verified', false);
      }

      if (violationType) {
        query = query.eq('violation_type', violationType);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      return {
        data: data.map((item) => ({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          violationType: item.violation_type,
          description: item.description,
          imageUrl: item.image_url,
          reportedBy: item.reported_by,
          isVerified: item.is_verified,
          upvotes: item.upvotes,
          createdAt: item.created_at,
        })),
        total: count ?? 0,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Failed to get reports', error);
      throw new InternalServerErrorException('Failed to fetch reports');
    }
  }

  async updateReportStatus(
    reportId: string,
    updateStatusDto: UpdateReportStatusDto,
  ) {
    const isVerified = updateStatusDto.status === 'verified';

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .update({
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    return {
      message: `Report ${updateStatusDto.status} successfully`,
      data,
    };
  }

  async getUsers(limit: number = 50, offset: number = 0) {
    try {
      const { data, error, count } = await this.supabaseService
        .getAdminClient()
        .from('profiles')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      return {
        data: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Failed to get users', error);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async deleteUser(userId: string) {
    this.logger.log(`Deleting user: ${userId}`);

    const { error } = await this.supabaseService
      .getAdminClient()
      .auth.admin.deleteUser(userId);

    if (error) {
      this.logger.error(`Failed to delete user ${userId}`, error.message);
      throw new InternalServerErrorException(`Failed to delete user: ${error.message}`);
    }

    return {
      success: true,
      message: `User ${userId} deleted successfully`,
    };
  }

  async getHeatmapData(limit: number = 1000) {
    try {
      const { data, error } = await this.supabaseService
        .getAdminClient()
        .from('history')
        .select('latitude, longitude, detection_type, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      return {
        data: data.map((item) => ({
          latitude: item.latitude,
          longitude: item.longitude,
          detectionType: item.detection_type,
          timestamp: item.created_at,
        })),
        total: data.length,
      };
    } catch (error) {
      this.logger.error('Failed to get heatmap data', error);
      throw new InternalServerErrorException('Failed to fetch heatmap data');
    }
  }
}
