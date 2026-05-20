import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReportDto } from './dto/create-report.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createReport(userId: string, createReportDto: CreateReportDto) {
    const reportId = createReportDto.id ?? randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .insert([
        {
          id: reportId,
          latitude: createReportDto.latitude,
          longitude: createReportDto.longitude,
          violation_type: createReportDto.violationType,
          description: createReportDto.description,
          image_url: createReportDto.imageUrl ?? null,
          reported_by: userId,
          is_verified: false,
          upvotes: 0,
          timestamp: now,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create report', error.message);
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return {
      message: 'Report created successfully',
      data: this.mapReport(data),
    };
  }

  async syncReports(reports: CreateReportDto[]) {
    this.logger.log(`Syncing ${reports.length} reports to Supabase`);

    const formattedReports = reports.map((report) => ({
      id: report.id ?? randomUUID(),
      latitude: report.latitude,
      longitude: report.longitude,
      violation_type: report.violationType,
      description: report.description,
      timestamp: new Date(report.timestamp).toISOString(),
      reported_by: report.reportedBy,
      image_url: report.imageUrl ?? null,
      is_verified: report.isVerified ?? false,
      upvotes: report.upvotes ?? 0,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .upsert(formattedReports, { onConflict: 'id' });

    if (error) {
      this.logger.error('Failed to sync reports to Supabase', error.message);
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return {
      success: true,
      syncedCount: reports.length,
      syncedIds: reports.map((r) => r.id),
    };
  }

  async incrementUpvotes(reportId: string) {
    this.logger.log(`Incrementing upvotes for report: ${reportId}`);

    const { data: currentData, error: fetchError } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .select('upvotes')
      .eq('id', reportId)
      .single();

    if (fetchError || !currentData) {
      throw new NotFoundException('Report not found');
    }

    const newUpvotes = (currentData.upvotes ?? 0) + 1;

    const { error: updateError } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .update({ upvotes: newUpvotes, updated_at: new Date().toISOString() })
      .eq('id', reportId);

    if (updateError) {
      throw new InternalServerErrorException(`Supabase error: ${updateError.message}`);
    }

    return {
      success: true,
      reportId,
      upvotes: newUpvotes,
    };
  }

  async getReportsNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 5.0,
  ) {
    this.logger.log(
      `Fetching reports near lat:${latitude}, lon:${longitude} radius:${radiusKm}km`,
    );

    const latDelta = radiusKm / 111.0;
    const lonDelta =
      radiusKm / (111.0 * Math.cos((latitude * Math.PI) / 180));

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .select('*')
      .gte('latitude', latitude - latDelta)
      .lte('latitude', latitude + latDelta)
      .gte('longitude', longitude - lonDelta)
      .lte('longitude', longitude + lonDelta)
      .order('timestamp', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return data.map((item) => this.mapReport(item));
  }

  async getAllReports() {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return data.map((item) => this.mapReport(item));
  }

  async deleteReport(reportId: string) {
    this.logger.log(`Deleting report: ${reportId}`);

    const { error } = await this.supabaseService
      .getAdminClient()
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return { success: true, message: 'Report deleted successfully' };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private mapReport(item: any) {
    return {
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      violationType: item.violation_type,
      description: item.description,
      timestamp: new Date(item.timestamp).getTime(),
      reportedBy: item.reported_by,
      imageUrl: item.image_url,
      isVerified: item.is_verified === 1 || item.is_verified === true,
      upvotes: item.upvotes ?? 0,
      createdAt: new Date(item.created_at ?? item.timestamp).getTime(),
      updatedAt: new Date(item.updated_at ?? item.timestamp).getTime(),
    };
  }
}
