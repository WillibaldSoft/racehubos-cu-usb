import test from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import { CuTransport } from '../server/transport.js';

function link() {
  const result = new EventEmitter();
  result.connected = false;
  result.connect = async (address) => {
    result.address = address;
    result.connected = true;
    result.emit('ready');
  };
  result.disconnect = async () => {
    result.connected = false;
    result.emit('disconnect');
  };
  result.send = async (data) => data;
  result.scan = async () => ({ address: 'ble:cu' });
  return result;
}

test('routes USB and BLE connections and commands without forwarding inactive events', async () => {
  const ble = link();
  const serial = link();
  const transport = new CuTransport(ble, serial);
  let disconnected = 0;
  transport.on('disconnect', () => disconnected++);
  await transport.connect('usb:COM3');
  assert.equal(serial.address, 'usb:COM3');
  assert.equal(transport.connected, true);
  ble.emit('disconnect');
  assert.equal(disconnected, 1); // switching away from BLE closed the old link
  assert.equal(transport.peripheral.address, 'usb:COM3');
  assert.equal((await transport.send(Buffer.from('?'))).toString(), '?');
  await transport.disconnect();
  assert.equal(transport.manualDisconnect, true);
  await transport.connect('ble:cu');
  assert.equal(transport.manualDisconnect, false);
  assert.equal(ble.address, 'ble:cu');
  serial.emit('ready');
  assert.equal(transport.active, ble);
});

test('rejects overlapping connects and closes an opening connection on manual disconnect', async () => {
  const ble = link();
  let open;
  ble.connect = () =>
    new Promise((resolve) => {
      open = resolve;
    });
  const transport = new CuTransport(ble, link());
  const connecting = transport.connect('ble:cu');
  await new Promise((resolve) => setImmediate(resolve));
  assert.throws(() => transport.connect('usb:COM3'), /progress/);
  const closing = transport.disconnect();
  open();
  await Promise.all([connecting, closing]);
  assert.equal(transport.connected, false);
  assert.equal(transport.manualDisconnect, true);
});
