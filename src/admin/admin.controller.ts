import {
  Controller,
  Get,
  Post,
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
import { SupabaseGuard } from '../auth/supabase.guard';
import { AdminGuard } from './admin.guard';
import { ClusteringService } from './clustering.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(SupabaseGuard, AdminGuard)
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly clusteringService: ClusteringService,
  ) {}

  @Post('cluster')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger DBSCAN spatial clustering on pending reports' })
  @ApiResponse({ status: 200, description: 'Clustering ran successfully' })
  triggerClustering() {
    return this.clusteringService.runClustering();
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics (users, reports, history counts)' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
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

  @Get('history')
  @ApiOperation({ summary: 'Get all detection history for admin' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  getHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getHistory(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Patch('history/:id')
  @ApiOperation({ summary: 'Update history record' })
  updateHistory(
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    return this.adminService.updateHistory(id, payload);
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Delete a history record' })
  deleteHistory(@Param('id') id: string) {
    return this.adminService.deleteHistory(id);
  }

  @Get('history/heatmap')
  @ApiOperation({ summary: 'Get heatmap data from detection history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 1000 })
  getHeatmapData(@Query('limit') limit?: string) {
    return this.adminService.getHeatmapData(limit ? parseInt(limit) : 1000);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get all reports with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'violationType', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getReports(
    @Query('status') status?: string,
    @Query('violationType') violationType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getReports(status, violationType, limit ? parseInt(limit) : 50, offset ? parseInt(offset) : 0);
  }

  @Patch('reports/:id/status')
  @ApiOperation({ summary: 'Update report status' })
  updateReportStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('notes') notes?: string,
  ) {
    return this.adminService.updateReportStatus(id, status, notes);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Update report details' })
  updateReport(
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    return this.adminService.updateReport(id, payload);
  }

  @Delete('reports/:id')
  @ApiOperation({ summary: 'Delete a report' })
  deleteReport(@Param('id') id: string) {
    return this.adminService.deleteReport(id);
  }

  @Get('support')
  @ApiOperation({ summary: 'Get all support tickets with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getSupportTickets(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getSupportTickets(status, limit ? parseInt(limit) : 50, offset ? parseInt(offset) : 0);
  }

  @Patch('support/:id/status')
  @ApiOperation({ summary: 'Update support ticket status' })
  updateSupportTicketStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('notes') notes?: string,
  ) {
    return this.adminService.updateSupportTicketStatus(id, status, notes);
  }

  @Delete('support/:id')
  @ApiOperation({ summary: 'Delete a support ticket' })
  deleteSupportTicket(@Param('id') id: string) {
    return this.adminService.deleteSupportTicket(id);
  }
}
