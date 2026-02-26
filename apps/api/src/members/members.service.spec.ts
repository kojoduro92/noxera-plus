import { MembersService } from './members.service';

describe('MembersService', () => {
  let service: MembersService;

  beforeEach(() => {
    service = new MembersService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
