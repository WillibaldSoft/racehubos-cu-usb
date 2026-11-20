import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useDevice } from '@/context/DeviceContext';
import { useServerSocket } from '@/hooks/useServerSocket';

const EVENTS = ['cu-usb:devices', 'connect'];
const API_URL = import.meta.env.VITE_API_URL || '';

export default function UsbDevices({ onLog = () => {} }) {
  const { t } = useTranslation('cu-usb');
  const device = useDevice();
  const [snapshot, setSnapshot] = useState({ devices: [] });
  const log = useEffectEvent(onLog);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/addons/cu-usb/devices`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(t('unavailable')))))
      .then(setSnapshot)
      .catch((error) => {
        if (error.name !== 'AbortError') log(error.message);
      });
    return () => controller.abort();
  }, [t]);
  useServerSocket(EVENTS, (event, data) => {
    if (event === 'cu-usb:devices') setSnapshot(data);
  });

  async function act(address, connected) {
    setBusy(true);
    try {
      const result = await (connected ? device.disconnect() : device.connect(address));
      if (!result.success) onLog(t('failed', { error: result.error }));
    } catch (error) {
      onLog(t('failed', { error: error.message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="cu-usb-devices" className="space-y-2 px-4 py-3">
      <h3 className="font-medium text-sm">{t('title')}</h3>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      {!snapshot.devices.length && (
        <p data-testid="cu-usb-empty" className="text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
      {snapshot.devices.map((port) => {
        const current = snapshot.connected && snapshot.address === port.address;
        return (
          <div key={port.address} data-testid="cu-usb-device" className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm">{port.address.slice(4)}</span>
            <Button
              data-testid="cu-usb-connect"
              size="sm"
              variant="outline"
              disabled={busy || device.connecting || snapshot.connecting || (snapshot.connected && !current)}
              onClick={() => act(port.address, current)}
            >
              {t(current ? 'disconnect' : 'connect')}
            </Button>
          </div>
        );
      })}
    </section>
  );
}
