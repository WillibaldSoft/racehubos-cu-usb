export class UsbDiscovery {
  constructor(
    ctx,
    { probe = (address) => ctx.services.controlUnit.ble.discover(address), now = Date.now, interval = 3000 } = {}
  ) {
    Object.assign(this, { ctx, probe, now });
    this.devices = [];
    this.verified = new Map();
    this.retryAt = new Map();
    this.pending = null;
    this.closed = false;
    this.onClient = (socket) => socket.emit('cu-usb:devices', this.snapshot());
    ctx.io.on('connection', this.onClient);
    this.timer = setInterval(() => void this.check().catch((error) => ctx.log.warn(error.message)), interval);
    this.timer.unref?.();
  }

  snapshot() {
    const { sync, controlUnit: cu } = this.ctx.services;
    return {
      devices: this.devices,
      connected: sync.isConnected(),
      address: sync.getDevice()?.address || null,
      status: sync.getCuStatus(),
      connecting: !!cu.ble.connecting,
    };
  }

  check() {
    if (this.closed) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.scan().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async scan() {
    const {
      services: { controlUnit: cu, sync },
      prisma,
      io,
    } = this.ctx;
    const ports = await cu.ble.serial.list();
    const addresses = new Set(ports.map((port) => port.address));
    for (const cache of [this.verified, this.retryAt])
      for (const address of cache.keys()) if (!addresses.has(address)) cache.delete(address);
    for (const port of ports) {
      if (this.closed) return;
      if (cu.isConnected() && cu.address === port.address) this.verified.set(port.address, port);
      if (cu.isConnected() || cu.ble.connecting || sync.getDevice()?.isConnected()) continue;
      if (this.verified.has(port.address) || (this.retryAt.get(port.address) || 0) > this.now()) continue;
      this.retryAt.set(port.address, this.now() + 15000);
      if (await this.probe(port.address)) this.verified.set(port.address, port);
    }
    if (this.closed) return;
    this.devices = [...this.verified.values()];
    io.emit('cu-usb:devices', this.snapshot());
    if (
      !this.devices.length ||
      cu.ble.manualDisconnect ||
      cu.isConnected() ||
      cu.ble.connecting ||
      sync.getDevice()?.isConnected()
    )
      return;
    const preference = await prisma.preference.findUnique({ where: { key: 'autoConnect' } });
    if (
      preference?.value !== 'true' ||
      this.closed ||
      cu.ble.manualDisconnect ||
      cu.ble.connecting ||
      cu.isConnected() ||
      sync.getDevice()?.isConnected()
    )
      return;
    const device = this.devices[0];
    await cu.connect(device.address);
    if (this.closed || cu.ble.manualDisconnect) {
      await cu.disconnect();
      return;
    }
    sync.setDevice(cu);
    sync.startPolling();
    await prisma.device.upsert({
      where: { address: device.address },
      update: { lastConnected: new Date() },
      create: { address: device.address, name: 'Control Unit USB', type: 'cu', lastConnected: new Date() },
    });
    io.emit('cu-usb:devices', this.snapshot());
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.ctx.io.off('connection', this.onClient);
  }
}
