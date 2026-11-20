import { test, expect } from '@playwright/test';

const cable = { address: 'usb:/dev/ttyUSB0', name: 'CU USB', type: 'controlUnit' };

async function setup(page, language = 'en') {
  const sockets = [];
  const calls = [];
  let snapshot = { devices: [], connected: false, address: null, status: null, connecting: false };
  await page.addInitScript((lang) => localStorage.setItem('racehubos-lang', lang), language);
  await page.routeWebSocket('**/socket.io/**', (socket) => {
    socket.send('0' + JSON.stringify({ sid: 'test', upgrades: [], pingInterval: 25000, pingTimeout: 20000 }));
    socket.onMessage((message) => {
      if (message === '40') {
        socket.send('40' + JSON.stringify({ sid: 'test' }));
        sockets.push(socket);
        socket.send('42' + JSON.stringify(['cu-usb:devices', snapshot]));
      }
    });
  });
  const publish = (next) => {
    snapshot = next;
    for (const socket of sockets) socket.send('42' + JSON.stringify(['cu-usb:devices', next]));
  };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = { success: true, data: [] };
    if (path === '/api/addons/cu-usb/devices') data = snapshot;
    else if (path === '/api/bluetooth/status')
      data = { connected: snapshot.connected, deviceAddress: snapshot.address };
    else if (path === '/api/bluetooth/connect') {
      calls.push(JSON.parse(route.request().postData()).address);
      publish({ ...snapshot, connected: true, address: cable.address });
      data = { success: true, deviceType: 'controlUnit' };
    } else if (path === '/api/bluetooth/disconnect') {
      calls.push('disconnect');
      publish({ ...snapshot, connected: false, address: null });
      data = { success: true };
    } else if (path === '/api/preferences') data = { success: true, data: {} };
    else if (path.startsWith('/api/preferences/')) data = { success: true, data: null };
    else if (path === '/api/settings') data = { success: true, data: {} };
    else if (path === '/api/config') data = { success: true, data: {} };
    else if (path === '/api/update/check') data = { success: true, upToDate: true };
    await route.fulfill({ json: data });
  });
  await page.goto('/settings');
  await expect(page.getByTestId('cu-usb-empty')).toBeVisible();
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  return { calls, publish };
}

test('appears automatically on insertion, connects and disconnects, and disappears on removal', async ({ page }) => {
  const { calls, publish } = await setup(page);
  publish({ devices: [cable], connected: false });
  await expect(page.getByTestId('cu-usb-device')).toContainText('/dev/ttyUSB0');
  await page.getByTestId('cu-usb-connect').click();
  expect(calls).toEqual([cable.address]);
  await expect(page.getByTestId('cu-usb-connect')).toHaveText('Disconnect');
  await page.getByTestId('cu-usb-connect').click();
  expect(calls).toEqual([cable.address, 'disconnect']);
  publish({ devices: [], connected: false });
  await expect(page.getByTestId('cu-usb-empty')).toBeVisible();
  await expect(page.getByTestId('settings-devices')).toBeVisible(); // @base remains present
});

for (const [lang, title] of [
  ['de', 'USB-Control-Unit'],
  ['fr', 'Control Unit USB'],
]) {
  test(`labels are translated in ${lang} and cannot replace another active device`, async ({ page }) => {
    const { publish } = await setup(page, lang);
    await expect(page.getByTestId('cu-usb-devices')).toContainText(title);
    publish({ devices: [cable], connected: true, address: 'ble:other' });
    await expect(page.getByTestId('cu-usb-connect')).toBeDisabled();
  });
}
