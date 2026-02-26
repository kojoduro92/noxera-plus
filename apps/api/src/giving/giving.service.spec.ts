import { GivingService } from './giving.service';

describe('GivingService', () => {
  let service: GivingService;

  beforeEach(() => {
    service = new GivingService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
