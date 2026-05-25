import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getDashboardStats() {
    try {
      const client = this.supabaseService.getAdminClient();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 6);
      lastWeek.setHours(0, 0, 0, 0);
      const lastWeekIso = lastWeek.toISOString();

      const [
        { count: totalUsers },
        { count: historyRecords },
        { count: totalReports },
        { count: verifiedReports },
        { count: newUsersToday },
        { data: recentDetections },
        { data: weeklyDetectionsData },
        { data: recentActivityData },
      ] = await Promise.all([
        client.from('profiles').select('id', { count: 'exact', head: true }),
        client.from('history').select('id', { count: 'exact', head: true }),
        client.from('community_reports').select('id', { count: 'exact', head: true }),
        client.from('community_reports').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
        client.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
        client.from('history').select('detection_type').order('created_at', { ascending: false }).limit(1000),
        client.from('history').select('created_at').gte('created_at', lastWeekIso),
        client.from('history').select('id, user_id, detection_type, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const labelDistribution: Record<string, number> = {};
      if (recentDetections) {
        recentDetections.forEach((d: any) => {
          const label = d.detection_type || 'Unknown';
          labelDistribution[label] = (labelDistribution[label] || 0) + 1;
        });
      }

      const topLabels = Object.entries(labelDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((acc, [key, val]) => {
          acc[key] = val;
          return acc;
        }, {} as Record<string, number>);

      const weeklyDetections = [0, 0, 0, 0, 0, 0, 0];
      if (weeklyDetectionsData) {
        weeklyDetectionsData.forEach((d: any) => {
          const date = new Date(d.created_at);
          const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
          weeklyDetections[dayIndex]++;
        });
      }

      let recentActivity: any[] = [];
      if (recentActivityData && recentActivityData.length > 0) {
        const userIds = [...new Set(recentActivityData.map((r: any) => r.user_id))];
        const { data: profiles } = await client.from('profiles').select('id, display_name').in('id', userIds);
        const profileMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p.display_name || 'Người dùng ẩn danh';
          return acc;
        }, {});

        recentActivity = recentActivityData.map((r: any) => ({
          id: r.id,
          title: profileMap[r.user_id] || 'Người dùng ẩn danh',
          subtitle: `Phát hiện: ${r.detection_type}`,
          timestamp: r.created_at,
          type: 'detection',
        }));
      }

      return {
        totalUsers: totalUsers ?? 0,
        totalReports: totalReports ?? 0,
        verifiedReports: verifiedReports ?? 0,
        detectionHistory: historyRecords ?? 0,
        newUsersToday: newUsersToday ?? 0,
        labelDistribution: topLabels,
        weeklyDetections,
        recentActivity,
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
    }
  }

  async getUsers(limit: number = 50, offset: number = 0) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { data, error, count } = await client
        .from('profiles')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      const records = data || [];
      if (records.length > 0) {
        const userIds = records.map(u => u.id);
        const countsPromises = userIds.map(id => 
           client.from('history').select('id', { count: 'exact', head: true }).eq('user_id', id)
        );
        const countsResults = await Promise.all(countsPromises);
        
        records.forEach((user, index) => {
           user.total_detections = countsResults[index].count || 0;
        });
      }

      return {
        data: records,
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

  async getHistory(limit: number = 50, offset: number = 0) {
    try {
      const client = this.supabaseService.getAdminClient();

      // Fetch history data
      const { data: historyData, error, count } = await client
        .from('history')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      const records = historyData || [];
      
      // Fetch user profiles for the retrieved history records
      const userIds = [...new Set(records.map(r => r.user_id))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await client
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
          
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.display_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return {
        data: records.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          user_name: profilesMap[item.user_id] || 'Unknown',
          label: item.detection_type,
          confidence: item.confidence ?? 1.0, 
          latitude: item.latitude,
          longitude: item.longitude,
          location_name: item.description,
          image_url: item.image_url,
          detected_at: item.timestamp || item.created_at,
        })),
        total: count ?? 0,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Failed to get history', error);
      throw new InternalServerErrorException('Failed to fetch history');
    }
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

  async getReports(status?: string, violationType?: string, limit: number = 50, offset: number = 0) {
    try {
      const client = this.supabaseService.getAdminClient();
      let query = client.from('community_reports').select('*', { count: 'exact' });
      
      if (status) {
        query = query.eq('status', status);
      }
      if (violationType) {
        query = query.eq('violation_type', violationType);
      }
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new InternalServerErrorException(error.message);
      
      return {
        data: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Failed to get reports', error);
      throw new InternalServerErrorException('Failed to fetch reports');
    }
  }

  async updateReportStatus(id: string, status: string, notes?: string) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { data, error } = await client
        .from('community_reports')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new InternalServerErrorException(error.message);
      return data;
    } catch (error) {
      this.logger.error(`Failed to update report status ${id}`, error);
      throw new InternalServerErrorException('Failed to update report status');
    }
  }

  async updateReport(id: string, payload: any) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { data, error } = await client
        .from('community_reports')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      return data;
    } catch (error) {
      this.logger.error(`Failed to update report ${id}`, error);
      throw new InternalServerErrorException('Failed to update report');
    }
  }

  async deleteReport(id: string) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { error } = await client
        .from('community_reports')
        .delete()
        .eq('id', id);

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, message: `Report ${id} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete report ${id}`, error);
      throw new InternalServerErrorException('Failed to delete report');
    }
  }


  async updateHistory(id: string, payload: any) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { data, error } = await client
        .from('history')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      return data;
    } catch (error) {
      this.logger.error(`Failed to update history ${id}`, error);
      throw new InternalServerErrorException('Failed to update history');
    }
  }

  async deleteHistory(id: string) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { error } = await client
        .from('history')
        .delete()
        .eq('id', id);

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, message: `History record ${id} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete history ${id}`, error);
      throw new InternalServerErrorException('Failed to delete history');
    }
  }

  // --- Support Tickets Management ---
  async getSupportTickets(status?: string, limit: number = 50, offset: number = 0) {
    try {
      const client = this.supabaseService.getAdminClient();
      let query = client.from('support_tickets').select('*', { count: 'exact' });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new InternalServerErrorException(error.message);
      
      return {
        data: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Failed to get support tickets', error);
      throw new InternalServerErrorException('Failed to fetch support tickets');
    }
  }

  async updateSupportTicketStatus(id: string, status: string, notes?: string) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { data, error } = await client
        .from('support_tickets')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw new InternalServerErrorException(error.message);
      return data;
    } catch (error) {
      this.logger.error(`Failed to update support ticket status ${id}`, error);
      throw new InternalServerErrorException('Failed to update support ticket status');
    }
  }

  async deleteSupportTicket(id: string) {
    try {
      const client = this.supabaseService.getAdminClient();
      const { error } = await client
        .from('support_tickets')
        .delete()
        .eq('id', id);

      if (error) throw new InternalServerErrorException(error.message);
      return { success: true, message: `Support ticket ${id} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete support ticket ${id}`, error);
      throw new InternalServerErrorException('Failed to delete support ticket');
    }
  }
}
