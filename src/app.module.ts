import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { DetectionsModule } from './detections/detections.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Rate Limiting ───────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10, // 10 requests per second
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100, // 100 requests per minute
      },
    ]),

    // ─── Shared Modules ──────────────────────────────────────────────────────────
    SupabaseModule,

    // ─── Feature Modules ─────────────────────────────────────────────────────────
    AuthModule,
    DetectionsModule,
    AdminModule,
    ReportsModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
