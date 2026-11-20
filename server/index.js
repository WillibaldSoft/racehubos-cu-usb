import { UsbDiscovery } from './discovery.js';

export default function register(ctx) {
  const onError = (error) => ctx.log.warn(error.message);
  ctx.services.controlUnit.on('error', onError);
  const discovery = new UsbDiscovery(ctx);
  ctx.router.get('/devices', (_req, res) => res.set('Cache-Control', 'no-store').json(discovery.snapshot()));
  return () => {
    discovery.close();
    ctx.services.controlUnit.off('error', onError);
  };
}
