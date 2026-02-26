import { FollowupsService } from './followups.service';

describe('FollowupsService', () => {
  let service: FollowupsService;

  beforeEach(() => {
    service = new FollowupsService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
