import { BranchesService } from './branches.service';

describe('BranchesService', () => {
  let service: BranchesService;

  beforeEach(() => {
    service = new BranchesService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
