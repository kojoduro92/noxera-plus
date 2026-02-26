import { MembersController } from './members.controller';

describe('MembersController', () => {
  let controller: MembersController;

  beforeEach(() => {
    controller = new MembersController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
