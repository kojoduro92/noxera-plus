import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let service: GroupsService;

  beforeEach(() => {
    service = new GroupsService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
