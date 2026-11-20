import EventEmitter from 'node:events';
import { SerialService } from './serial.js';
import { probeCu } from './probe.js';

/** Keeps the core BLE API, routing only usb: addresses to the cable. */
export class CuTransport extends EventEmitter {
  constructor(bluetooth, serial = new SerialService()) {
    super();
    this.bluetooth = bluetooth;
    this.serial = serial;
    this.active = bluetooth;
    this.manualDisconnect = false;
    this.pending = null;
    this.probing = null;
    for (const link of [bluetooth, serial]) {
      for (const event of [
        'ready',
        'data',
        'error',
        'disconnect',
        'reconnect-failed',
        'connecting',
        'connected',
        'discovered',
      ]) {
        link.on(event, (...args) => {
          if (link === this.active) this.emit(event, ...args);
        });
      }
    }
  }

  get connected() {
    return this.active.connected ?? this.active.port?.isOpen ?? false;
  }
  get connecting() {
    return !!this.pending || !!this.probing || this.active.connecting;
  }
  get peripheral() {
    return this.active === this.serial ? { address: this.address } : this.bluetooth.peripheral;
  }

  async scan(timeout) {
    if (this.connected && this.active === this.serial) return this.peripheral;
    if (!this.connected && !this.connecting) {
      for (const port of await this.serial.list()) {
        if (await this.discover(port.address)) return { address: port.address };
      }
    }
    return this.bluetooth.scan(timeout);
  }

  discover(address) {
    if (this.connected || this.pending || this.probing) return Promise.resolve(false);
    const job = probeCu(address).finally(() => {
      if (this.probing === job) this.probing = null;
    });
    this.probing = job;
    return job;
  }

  connect(address) {
    if (this.pending) throw new Error('Connection already in progress');
    this.manualDisconnect = false;
    const job = Promise.resolve()
      .then(async () => {
        await this.probing;
        const next = address?.startsWith('usb:') ? this.serial : this.bluetooth;
        if (this.active !== next) await this.active.disconnect();
        this.active = next;
        this.address = address;
        await next.connect(address);
      })
      .finally(() => {
        if (this.pending === job) this.pending = null;
      });
    this.pending = job;
    return job;
  }

  async disconnect() {
    this.manualDisconnect = true;
    await this.probing?.catch(() => {});
    await this.pending?.catch(() => {});
    await this.active.disconnect();
  }

  send(data) {
    return this.active.send(data);
  }
  isConnected() {
    return this.connected;
  }
  getPeripheralInfo() {
    return this.active === this.serial ? null : this.bluetooth.getPeripheralInfo?.();
  }
}
