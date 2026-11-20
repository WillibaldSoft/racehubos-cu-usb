import { test } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'events';
import { SerialService } from '../server/serial.js';

class FakePort extends EventEmitter {
  static async list() {
    return [{ path: 'COM3', manufacturer: 'FTDI', vendorId: '0403' }, { path: '/dev/ttyS0' }];
  }
  constructor(options) {
    super();
    this.options = options;
  }
  open(callback) {
    this.isOpen = true;
    callback();
  }
  close(callback) {
    this.isOpen = false;
    this.emit('close');
    callback();
  }
  write(data, callback) {
    this.written = data;
    callback();
  }
  drain(callback) {
    callback();
  }
}
const create = () => new SerialService({ loadDriver: async () => ({ SerialPort: FakePort }) });

test('discovers USB ports and opens the selected port using CU serial settings', async () => {
  const serial = create();
  assert.equal((await serial.list()).length, 1);
  assert.equal((await serial.list())[0].address, 'usb:COM3');
  let ready = false;
  serial.on('ready', () => {
    ready = true;
  });
  await serial.connect('usb:COM3');
  assert.equal(ready, true);
  assert.equal(serial.port.options.baudRate, 19200);
  assert.equal(serial.port.options.path, 'COM3');
  await serial.send(Buffer.from('?'));
  assert.equal(serial.port.written.toString(), '"?$');
  let disconnected = false;
  serial.on('disconnect', () => {
    disconnected = true;
  });
  await serial.disconnect();
  assert.equal(disconnected, true);
  await assert.rejects(serial.send(Buffer.from('?')), /not connected/);
});

test('reassembles split frames and handles multiple $ and # terminated replies', () => {
  const serial = create();
  const frames = [];
  serial.on('data', (data) => frames.push(data.toString()));
  serial.handleData(Buffer.from('053'));
  assert.deepEqual(frames, []);
  serial.handleData(Buffer.from('37X$?:123#T2X$'));
  assert.deepEqual(frames, ['05337X', '?:123', 'T2X']);
});

test('clears partial replies on disconnect and bounds malformed input', async () => {
  const serial = create();
  serial.handleData(Buffer.from('partial'));
  await serial.disconnect();
  assert.equal(serial.buffer.length, 0);
  const errors = [];
  serial.on('error', (error) => errors.push(error));
  serial.handleData(Buffer.alloc(257, 65));
  assert.equal(errors.length, 1);
  assert.equal(serial.buffer.length, 0);
});
