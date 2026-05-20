import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const STORAGE_BUCKET = 'images';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<{ url: string; path: string }> {
    // ─── Validate ──────────────────────────────────────────────────────────────
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 5MB`,
      );
    }

    // ─── Generate unique path ──────────────────────────────────────────────────
    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const storagePath = `${folder}/${filename}`;

    this.logger.log(`Uploading image to ${STORAGE_BUCKET}/${storagePath}`);

    // ─── Upload to Supabase Storage ────────────────────────────────────────────
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error('Failed to upload image', error.message);
      throw new InternalServerErrorException(`Storage error: ${error.message}`);
    }

    // ─── Get public URL ────────────────────────────────────────────────────────
    const { data: urlData } = this.supabaseService
      .getAdminClient()
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  }

  async deleteImage(path: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAdminClient()
      .storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (error) {
      this.logger.error(`Failed to delete image at path: ${path}`, error.message);
      throw new InternalServerErrorException(`Storage error: ${error.message}`);
    }
  }
}
