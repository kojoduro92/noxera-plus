import { FollowupsController } from './followups.controller';

describe('FollowupsController', () => {
  let controller: FollowupsController;

  beforeEach(() => {
    controller = new FollowupsController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
