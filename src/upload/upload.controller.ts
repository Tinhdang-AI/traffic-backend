import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { SupabaseGuard } from '../auth/supabase.guard';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(SupabaseGuard)
@ApiBearerAuth('access-token')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload an image to Supabase Storage',
    description:
      'Accepts multipart/form-data with a `file` field. Returns the public URL. Supported: JPEG, PNG, WebP, GIF (max 5MB).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP, GIF) — max 5MB',
        },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    required: false,
    type: String,
    description: 'Storage subfolder (e.g., "reports", "history"). Defaults to "uploads".',
    example: 'reports',
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Image uploaded successfully' },
        url: {
          type: 'string',
          example: 'https://xxx.supabase.co/storage/v1/object/public/images/reports/uuid.jpg',
        },
        path: { type: 'string', example: 'reports/uuid.jpg' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No file provided, invalid type, or file too large' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // Keep file in memory buffer for Supabase upload
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB guard at multer level
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided. Use multipart/form-data with field name "file".');
    }

    const result = await this.uploadService.uploadImage(file, folder ?? 'uploads');

    return {
      message: 'Image uploaded successfully',
      url: result.url,
      path: result.path,
    };
  }
}
