import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({
    description: 'Unique identifier of the report (UUID). If not provided, server will generate one.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    description: 'Latitude of the violation location',
    example: 10.7769,
  })
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Longitude of the violation location',
    example: 106.7009,
  })
  @IsNumber()
  longitude: number;

  @ApiProperty({
    description: 'Type of traffic violation',
    example: 'wrong_way',
    enum: ['speed_limit', 'wrong_way', 'parking', 'red_light', 'no_helmet', 'other'],
  })
  @IsString()
  violationType: string;

  @ApiProperty({
    description: 'Detailed description of the incident',
    example: 'Vehicle driving against traffic on Nguyen Hue street',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Timestamp of the incident in milliseconds since epoch',
    example: 1704067200000,
  })
  @IsNumber()
  timestamp: number;

  @ApiProperty({
    description: 'User ID of the reporter. If not provided, taken from auth token.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  reportedBy?: string;

  @ApiProperty({
    description: 'Optional URL of an image uploaded to Supabase Storage',
    example: 'https://xxx.supabase.co/storage/v1/object/public/images/report.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Verification status (managed by admin)',
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({
    description: 'Number of community upvotes',
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  upvotes?: number;
}
