import { IsString, IsEnum, IsOptional } from 'class-validator';

export class UpdateReportStatusDto {
  @IsEnum(['verified', 'rejected', 'pending'])
  status: 'verified' | 'rejected' | 'pending';

  @IsString()
  @IsOptional()
  reason?: string;
}
