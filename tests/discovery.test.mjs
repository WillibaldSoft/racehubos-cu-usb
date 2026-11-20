import test from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import { UsbDiscovery } from '../server/discovery.js';
import { probeCu } from '../server/probe.js';

function fixture({ auto = true, manual = false } = {}) {
  let ports = [{ address: 'usb:COM3', name: 'CU USB', type: 'controlUnit' }];
  const calls = [];
  const cu = {
    connected: false,
    ble: { manualDisconnect: manual, serial: { list: async () => ports } },
    isConnected() {
      return this.connected;
    },
    connect: async (address) => {
      cu.address = address;
      cu.connected = true;
      calls.push(address);
    },
  };
  const sync = {
    getDevice: () => null,
    isConnected: () => cu.connected,
    getCuStatus: () => null,
    setDevice: () => {},
    startPolling: () => {},
  };
  const ctx = {
    services: { controlUnit: cu, sync },
    io: new EventEmitter(),
    log: { warn() {} },
    prisma: { preference: { findUnique: async () => ({ value: String(auto) }) }, device: { upsert: async () => {} } },
  };
  const discovery = new UsbDiscovery(ctx, { probe: async () => true, interval: 100000 });
  return {
    discovery,
    cu,
    calls,
    ctx,
    ports: (value) => {
      ports = value;
    },
  };
}

test('identifies an inserted cable, connects if enabled, and removes unplugged devices', async () => {
  const f = fixture();
  try {
    await f.discovery.check();
    assert.deepEqual(f.calls, ['usb:COM3']);
    assert.equal(f.discovery.devices.length, 1);
    f.ports([]);
    await f.discovery.check();
    assert.deepEqual(f.discovery.devices, []);
  } finally {
    f.discovery.close();
  }
});

test('autoConnect off and manual disconnect still discover without connecting', async () => {
  for (const options of [{ auto: false }, { manual: true }]) {
    const f = fixture(options);
    try {
      await f.discovery.check();
      assert.equal(f.discovery.devices.length, 1);
      assert.deepEqual(f.calls, []);
    } finally {
      f.discovery.close();
    }
  }
});

test('never probes or replaces an active CU or simulator', async () => {
  for (const simulator of [true, false]) {
    const f = fixture();
    f.cu.connected = !simulator;
    if (simulator) f.ctx.services.sync.getDevice = () => ({ isConnected: () => true });
    f.discovery.probe = async () => {
      throw new Error('must not probe');
    };
    try {
      await f.discovery.check();
      assert.deepEqual(f.calls, []);
    } finally {
      f.discovery.close();
    }
  }
});

test('rejects foreign devices, limits retry rate, and stops work after unload', async () => {
  const f = fixture();
  let count = 0;
  f.discovery.probe = async () => {
    count++;
    return false;
  };
  try {
    await f.discovery.check();
    await f.discovery.check();
    assert.equal(count, 1);
    assert.deepEqual(f.discovery.devices, []);
    f.discovery.close();
    await f.discovery.check();
    assert.equal(count, 1);
  } finally {
    f.discovery.close();
  }
});

test('a manual disconnect or unload during a probe cancels auto-connection', async () => {
  for (const close of [true, false]) {
    const f = fixture();
    let release;
    f.discovery.probe = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const job = f.discovery.check();
    await new Promise((resolve) => setImmediate(resolve));
    if (close) f.discovery.close();
    else f.cu.ble.manualDisconnect = true;
    release(true);
    await job;
    assert.deepEqual(f.calls, []);
    f.discovery.close();
  }
});

test('probe accepts only valid version/checksum replies and always closes the cable', async () => {
  for (const [reply, expected] of [
    ['053394', true],
    ['053395', false],
    ['hello!', false],
    [null, false],
  ]) {
    const serial = new EventEmitter();
    let closed = false;
    serial.connect = async () => {};
    serial.send = async (data) => {
      assert.equal(data.toString(), '0');
      if (reply) serial.emit('data', Buffer.from(reply));
    };
    serial.disconnect = async () => {
      closed = true;
    };
    assert.equal(await probeCu('usb:COM3', { createSerial: () => serial, timeout: 5 }), expected);
    assert.equal(closed, true);
  }
});

test('a connection selected while loading preferences is not replaced', async () => {
  const f = fixture();
  f.ctx.prisma.preference.findUnique = async () => {
    f.ctx.services.sync.getDevice = () => ({ isConnected: () => true });
    return { value: 'true' };
  };
  try {
    await f.discovery.check();
    assert.deepEqual(f.calls, []);
  } finally {
    f.discovery.close();
  }
});
