import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health(): { status: string; service: string; time: string } {
    return {
      status: 'ok',
      service: 'api',
      time: new Date().toISOString(),
    };
  }
}
