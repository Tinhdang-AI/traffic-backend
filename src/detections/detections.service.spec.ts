import { Test, TestingModule } from '@nestjs/testing';
import { DetectionsService } from './detections.service';

describe('DetectionsService', () => {
  let service: DetectionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DetectionsService],
    }).compile();

    service = module.get<DetectionsService>(DetectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
