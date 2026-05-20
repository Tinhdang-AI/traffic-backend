import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateHistoryDto } from './dto/create-history.dto';

@Injectable()
export class DetectionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createHistory(userId: string, createHistoryDto: CreateHistoryDto) {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('history')
      .insert([
        {
          user_id: userId,
          latitude: createHistoryDto.latitude,
          longitude: createHistoryDto.longitude,
          detection_type: createHistoryDto.detectionType,
          description: createHistoryDto.description ?? null,
          image_url: createHistoryDto.imageUrl ?? null,
          timestamp: createHistoryDto.timestamp ?? new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Detection history saved successfully',
      data,
    };
  }

  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabaseService
      .getAdminClient()
      .from('history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Detection history retrieved successfully',
      data,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
  }

  async deleteHistory(id: string, userId: string) {
    // Verify ownership
    const { data: record, error: fetchError } = await this.supabaseService
      .getAdminClient()
      .from('history')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      throw new NotFoundException('History record not found');
    }

    if (record.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to delete this record');
    }

    const { error } = await this.supabaseService
      .getAdminClient()
      .from('history')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'History record deleted successfully',
    };
  }
}
