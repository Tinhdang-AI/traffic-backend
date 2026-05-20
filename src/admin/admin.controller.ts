import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { SupabaseGuard } from '../auth/supabase.guard';
import { AdminGuard } from './admin.guard';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(SupabaseGuard, AdminGuard)
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics (users, reports, history counts)' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get all reports with optional filters and pagination' })
  @ApiQuery({ name: 'status', required: false, enum: ['verified', 'pending', 'rejected'] })
  @ApiQuery({ name: 'violationType', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  getReports(
    @Query('status') status?: string,
    @Query('violationType') violationType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getAllReports(
      status,
      violationType,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Patch('reports/:id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update report status (verify or reject)' })
  @ApiParam({ name: 'id', type: String, description: 'Report UUID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  updateReportStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateReportStatusDto,
  ) {
    return this.adminService.updateReportStatus(id, updateStatusDto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get paginated list of users' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  getUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getUsers(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user account (admin only)' })
  @ApiParam({ name: 'id', type: String, description: 'User UUID from Supabase Auth' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 500, description: 'Failed to delete user' })
  deleteUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('history/heatmap')
  @ApiOperation({ summary: 'Get heatmap data from detection history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 1000 })
  getHeatmapData(@Query('limit') limit?: string) {
    return this.adminService.getHeatmapData(limit ? parseInt(limit) : 1000);
  }
}
