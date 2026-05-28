import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(userId: string, createReportDto: CreateReportDto) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('community_reports')
      .insert({
        user_id: userId,
        name: createReportDto.name,
        latitude: createReportDto.latitude,
        longitude: createReportDto.longitude,
        violation_type: createReportDto.violationType,
        description: createReportDto.description,
        image_url: createReportDto.imageUrl,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async findAll(limit: number = 50, offset: number = 0) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error, count } = await supabase
      .from('community_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException(error.message);
    return { data, total: count };
  }

  async findNearby(lat: number, lng: number, radiusKm: number = 5) {
    const supabase = this.supabaseService.getAdminClient();
    const radiusMeters = radiusKm * 1000;

    const { data, error } = await supabase
      .rpc('get_nearby_approved_signs', {
        lat: lat,
        lng: lng,
        radius_meters: radiusMeters,
      });

    if (error) {
      // Fallback if RPC doesn't exist yet (for smooth migration)
      const latDelta = radiusKm / 111.0;
      const lngDelta = radiusKm / (111.0 * Math.cos(lat * (Math.PI / 180)));

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('community_reports')
        .select('*')
        .eq('status', 'verified')
        .gte('latitude', lat - latDelta)
        .lte('latitude', lat + latDelta)
        .gte('longitude', lng - lngDelta)
        .lte('longitude', lng + lngDelta)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fallbackError) throw new InternalServerErrorException(fallbackError.message);
      
      const mapped = (fallbackData || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        violationType: r.violation_type,
        description: r.description,
        upvotes: r.upvotes,
        createdAt: r.created_at,
        userId: r.user_id,
        imageUrl: r.image_url,
        isVerified: r.is_verified,
      }));
      return { reports: mapped, total: mapped.length };
    }

    // Map approved signs to match what Mobile App expects
    const reports = (data || []).map((item: any) => ({
      id: item.id,
      name: `Approved Sign: ${item.label}`,
      latitude: item.latitude,
      longitude: item.longitude,
      violationType: item.label,
      description: `Traffic sign approved by community voting. (${item.reports_count} reports, ${item.upvotes} votes)`,
      upvotes: item.upvotes,
      createdAt: item.created_at || item.updated_at || new Date().toISOString(),
      userId: 'system',
      imageUrl: null,
      isVerified: true,
    }));

    return { reports, total: reports.length };
  }

  async findOne(id: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new NotFoundException('Report not found');
    return data;
  }

  async upvote(id: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();
    // Simplified upvote
    const { data: report, error: fetchError } = await supabase
      .from('community_reports')
      .select('upvotes')
      .eq('id', id)
      .single();
      
    if (fetchError) throw new NotFoundException('Report not found');

    const { data, error } = await supabase
      .from('community_reports')
      .update({ upvotes: (report.upvotes || 0) + 1 })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async update(id: string, userId: string, updateReportDto: UpdateReportDto) {
    const supabase = this.supabaseService.getAdminClient();
    
    // Check ownership
    const report = await this.findOne(id);
    if (report.user_id !== userId) {
      throw new BadRequestException('You can only update your own reports');
    }

    const payload: any = {};
    if (updateReportDto.name) payload.name = updateReportDto.name;
    if (updateReportDto.latitude) payload.latitude = updateReportDto.latitude;
    if (updateReportDto.longitude) payload.longitude = updateReportDto.longitude;
    if (updateReportDto.violationType) payload.violation_type = updateReportDto.violationType;
    if (updateReportDto.description) payload.description = updateReportDto.description;
    if (updateReportDto.imageUrl) payload.image_url = updateReportDto.imageUrl;

    const { data, error } = await supabase
      .from('community_reports')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async remove(id: string, userId: string) {
    const supabase = this.supabaseService.getAdminClient();
    
    // Check ownership
    const report = await this.findOne(id);
    if (report.user_id !== userId) {
      throw new BadRequestException('You can only delete your own reports');
    }

    const { error } = await supabase
      .from('community_reports')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException(error.message);
    return { success: true };
  }
}
