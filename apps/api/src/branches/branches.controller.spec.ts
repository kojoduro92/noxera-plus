import { BranchesController } from './branches.controller';

describe('BranchesController', () => {
  let controller: BranchesController;

  beforeEach(() => {
    controller = new BranchesController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
