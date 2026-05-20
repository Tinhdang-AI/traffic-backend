import { Test, TestingModule } from '@nestjs/testing';
import { DetectionsController } from './detections.controller';
import { DetectionsService } from './detections.service';

describe('DetectionsController', () => {
  let controller: DetectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetectionsController],
      providers: [DetectionsService],
    }).compile();

    controller = module.get<DetectionsController>(DetectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
