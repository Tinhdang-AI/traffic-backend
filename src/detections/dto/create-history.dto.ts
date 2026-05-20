import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHistoryDto {
  @ApiProperty({
    description: 'Latitude of the detection location',
    example: 10.7769,
  })
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Longitude of the detection location',
    example: 106.7009,
  })
  @IsNumber()
  longitude: number;

  @ApiProperty({
    description: 'Type of object/violation detected (e.g., helmet, speeding, wrong_way)',
    example: 'no_helmet',
  })
  @IsString()
  detectionType: string;

  @ApiProperty({
    description: 'Optional description of the detection event',
    example: 'Motorbike rider without helmet detected at intersection',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the detection event',
    example: '2024-01-01T12:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @ApiProperty({
    description: 'URL of the captured image from Supabase Storage',
    example: 'https://xxx.supabase.co/storage/v1/object/public/images/photo.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
