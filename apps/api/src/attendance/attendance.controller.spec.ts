import { AttendanceController } from './attendance.controller';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  beforeEach(() => {
    controller = new AttendanceController({} as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
