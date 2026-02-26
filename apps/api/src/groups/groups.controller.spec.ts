import { GroupsController } from './groups.controller';

describe('GroupsController', () => {
  let controller: GroupsController;

  beforeEach(() => {
    controller = new GroupsController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
