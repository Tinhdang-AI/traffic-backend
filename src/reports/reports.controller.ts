import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req, Put } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { SupabaseGuard } from '../auth/supabase.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reports' })
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.reportsService.findAll(limit ? parseInt(limit) : 50, offset ? parseInt(offset) : 0);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby reports' })
  findNearby(
    @Query('latitude') lat: string,
    @Query('longitude') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.reportsService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 5,
    );
  }

  @Post()
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new report' })
  create(@Req() req, @Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(req.user.id, createReportDto);
  }

  @Post(':id/upvote')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upvote a report' })
  upvote(@Param('id') id: string, @Req() req) {
    return this.reportsService.upvote(id, req.user.id);
  }

  @Put(':id')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a report (User only)' })
  update(@Param('id') id: string, @Req() req, @Body() updateReportDto: UpdateReportDto) {
    return this.reportsService.update(id, req.user.id, updateReportDto);
  }

  @Delete(':id')
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a report (User only)' })
  remove(@Param('id') id: string, @Req() req) {
    return this.reportsService.remove(id, req.user.id);
  }
}
