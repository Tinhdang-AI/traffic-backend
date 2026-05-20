import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DetectionsService } from './detections.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { SupabaseGuard } from '../auth/supabase.guard';

@ApiTags('History')
@Controller('history')
@UseGuards(SupabaseGuard)
@ApiBearerAuth('access-token')
export class DetectionsController {
  constructor(private readonly detectionsService: DetectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a detection history record' })
  @ApiResponse({ status: 201, description: 'History record saved' })
  createHistory(@Body() createHistoryDto: CreateHistoryDto, @Req() req: any) {
    return this.detectionsService.createHistory(req.user.id, createHistoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated detection history for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated detection history' })
  getHistory(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.detectionsService.getHistory(req.user.id, page, limit);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a history record (owner only)' })
  @ApiParam({ name: 'id', type: String, description: 'History record ID' })
  @ApiResponse({ status: 200, description: 'History record deleted' })
  @ApiResponse({ status: 403, description: 'Not the owner of this record' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  deleteHistory(@Param('id') id: string, @Req() req: any) {
    return this.detectionsService.deleteHistory(id, req.user.id);
  }
}
