import { SerialService } from './serial.js';

/** Identifies a CU using only its version command; never sends race commands. */
export async function probeCu(address, { createSerial = () => new SerialService(), timeout = 1000 } = {}) {
  const link = createSerial();
  let timer;
  let onData;
  let onError;
  try {
    link.on('error', () => {});
    await link.connect(address);
    const answer = new Promise((resolve, reject) => {
      onData = resolve;
      onError = reject;
      link.on('data', onData);
      link.on('error', onError);
      timer = setTimeout(() => reject(new Error('USB CU version timeout')), timeout);
    });
    const [, frame] = await Promise.all([link.send(Buffer.from('0')), answer]);
    const sum = [...frame.subarray(0, -1)].reduce((a, b) => a + b, 0) & 15;
    return frame.length === 6 && /^0[0-9]{4}/.test(frame.toString('ascii')) && frame[5] === 0x30 + sum;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    await link.disconnect().catch(() => {});
    link.off('data', onData);
    // Keep error handling until all native port callbacks have settled.
  }
}
