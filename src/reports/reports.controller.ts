import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseFloatPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { SyncReportsDto } from './dto/sync-reports.dto';
import { SupabaseGuard } from '../auth/supabase.guard';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new report' })
  createReport(@Body() createReportDto: CreateReportDto, @Req() req: any) {
    const userId = req.user.id;
    return this.reportsService.createReport(userId, createReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get reports (optionally filtered by location)' })
  @ApiQuery({ name: 'latitude', type: Number, required: false })
  @ApiQuery({ name: 'longitude', type: Number, required: false })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  getReports(
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const radius = radiusKm ? parseFloat(radiusKm) : 5.0;
      return this.reportsService.getReportsNearby(lat, lon, radius);
    }
    return this.reportsService.getAllReports();
  }

  @Post(':id/upvote')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upvote a report' })
  upvote(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reportsService.incrementUpvotes(id);
  }

  @Delete(':id')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a report' })
  deleteReport(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.reportsService.deleteReport(id);
  }

  @Post('sync')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync batch of offline reports to cloud database' })
  sync(@Body() syncReportsDto: SyncReportsDto) {
    return this.reportsService.syncReports(syncReportsDto.reports);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Retrieve reported violations near coordinates' })
  @ApiQuery({ name: 'latitude', type: Number, required: true })
  @ApiQuery({ name: 'longitude', type: Number, required: true })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  findNearby(
    @Query('latitude', ParseFloatPipe) latitude: number,
    @Query('longitude', ParseFloatPipe) longitude: number,
    @Query('radiusKm', new ParseFloatPipe({ optional: true })) radiusKm?: number,
  ) {
    return this.reportsService.getReportsNearby(latitude, longitude, radiusKm || 5.0);
  }
}


