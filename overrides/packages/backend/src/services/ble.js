export * from '@base';
import { BLEService as BaseBLEService } from '@base';
import { CuTransport } from '@addon/server/transport.js';

export class BLEService extends CuTransport {
  constructor(...args) {
    super(new BaseBLEService(...args));
  }
}
export default BLEService;
