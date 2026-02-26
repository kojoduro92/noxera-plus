import { ServicesService } from './services.service';

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(() => {
    service = new ServicesService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
