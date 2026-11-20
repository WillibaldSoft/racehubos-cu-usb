import EventEmitter from 'events';

/** Carrera PC Unit cable: 19200 baud, 8N1, commands framed by " and $. */
export class SerialService extends EventEmitter {
  constructor({ loadDriver = () => import('serialport') } = {}) {
    super();
    this.loadDriver = loadDriver;
    this.port = null;
    this.buffer = Buffer.alloc(0);
    this.connecting = false;
  }

  async list() {
    const { SerialPort } = await this.loadDriver();
    return (await SerialPort.list())
      .filter(
        (port) =>
          port.vendorId ||
          port.productId ||
          /usb/i.test(port.pnpId || '') ||
          /(?:ttyUSB|ttyACM|cu\.usb|tty\.usb)/i.test(port.path)
      )
      .map((port) => ({
        address: `usb:${port.path}`,
        name: `CU USB · ${port.manufacturer || port.friendlyName || port.path}`,
        type: 'controlUnit',
        transport: 'usb',
      }));
  }

  async connect(address) {
    if (!address?.startsWith('usb:') || !address.slice(4)) throw new Error('Invalid USB port');
    if (this.connecting) throw new Error('Connection already in progress');
    this.connecting = true;
    try {
      await this.disconnect();
      const { SerialPort } = await this.loadDriver();
      const port = new SerialPort({
        path: address.slice(4),
        baudRate: 19200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        autoOpen: false,
      });
      this.port = port;
      this.buffer = Buffer.alloc(0);
      port.on('data', (data) => {
        if (this.port === port) this.handleData(data);
      });
      port.on('error', (error) => {
        if (this.port === port) this.emit('error', error);
      });
      port.on('close', () => {
        if (this.port !== port) return;
        this.port = null;
        this.buffer = Buffer.alloc(0);
        this.emit('disconnect');
      });
      await new Promise((resolve, reject) => port.open((error) => (error ? reject(error) : resolve())));
      this.emit('ready');
    } catch (error) {
      await this.disconnect();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  handleData(data) {
    for (const byte of data) {
      if (byte === 0x24 || byte === 0x23) {
        const frame = this.buffer;
        this.buffer = Buffer.alloc(0);
        if (frame.length) this.emit('data', frame);
      } else {
        this.buffer = Buffer.concat([this.buffer, Buffer.from([byte])]);
        if (this.buffer.length > 256) {
          this.buffer = Buffer.alloc(0);
          this.emit('error', new Error('USB CU frame too long'));
        }
      }
    }
  }

  async send(data) {
    const port = this.port;
    if (!port?.isOpen) throw new Error('USB CU not connected');
    await new Promise((resolve, reject) => {
      port.write(Buffer.concat([Buffer.from('"'), data, Buffer.from('$')]), (error) => {
        if (error) return reject(error);
        port.drain((error) => (error ? reject(error) : resolve()));
      });
    });
  }

  async disconnect() {
    const port = this.port;
    if (port?.isOpen) {
      await new Promise((resolve, reject) => port.close((error) => (error ? reject(error) : resolve())));
    }
    if (this.port === port) this.port = null;
    this.buffer = Buffer.alloc(0);
  }
}
