import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService({} as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
