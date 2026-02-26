import { WebsiteService } from './website.service';

describe('WebsiteService', () => {
  let service: WebsiteService;

  beforeEach(() => {
    service = new WebsiteService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
