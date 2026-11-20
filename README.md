# USB Control Unit add-on for RaceHubOS

Connect a Carrera Digital 124/132 Control Unit using a compatible CU PC USB cable,
alongside the existing AppConnect Bluetooth transport. Developed against RaceHubOS
1.37.0 (main `3cda66b`).

The add-on discovers USB serial ports every three seconds, identifies the CU using
its version reply and checksum, and adds a USB section to the existing device
settings. With **Automatically connect** enabled, a discovered CU connects without
a manual scan. Active Bluetooth/simulator connections are preserved. Intentional
disconnection stops automatic connection until a manual connection or server restart.

## Install

Place this repository in `addons/cu-usb/`, or link it there. In this folder run
`npm ci`, then rebuild RaceHubOS with `npm run build` from the core repository and
restart the backend. Enable the add-on in the Add-ons manager if it is disabled.
Remove/disable it and rebuild to restore the original Bluetooth-only implementation.
No core source files, core versions, changelogs, schema or migrations are changed.

Connect the cable to the **backend computer**, even when using a tablet browser.
A regular USB cable or USB Bluetooth dongle cannot replace a compatible CU PC cable.
Install the cable manufacturer's driver when required. Linux users need permission
to read and write the serial device (often membership of `dialout`; log in again
after changing groups). Temporary ACL permissions may disappear after unplugging.

USB addresses use `usb:COM3`, `usb:/dev/ttyUSB0` or `usb:/dev/cu.usbserial-…`.
Changed port numbers are discovered again. Unresponsive/foreign devices are retried
at most once every 15 seconds. Identification sends only the version command; it
never starts a race, programs cars, or uploads firmware. Discovery pauses while a
CU or simulator is connected. The PC cable uses 19200 baud, 8N1, no flow control.

## Architecture

Two small `@base` wrappers compose the existing BLE transport and device-settings
component. Core exports, constructor arguments and component props are forwarded.
USB protocol, discovery and UI live in this repository. Events use the `cu-usb:`
prefix; routes use `/api/addons/cu-usb`; translations use the `cu-usb` namespace.
The existing auto-connect preference and device table are reused through `ctx.prisma`.
The add-on owns no database schema. Other add-ons' data are never changed.

## Contributing and validation

One coherent commit, Conventional Commits without scope (`feat: …`). Keep the core
version and changelog for the maintainer. Prettier owns formatting; do not introduce
ESLint errors. Backend tests use fake serial ports and never open real hardware or
a database. Browser tests mock API and WebSocket traffic; only the UI is exercised.

```sh
npm ci
npm run format
npm run lint
npm test
RACEHUBOS_HOST=/absolute/path/to/RaceHubOS npm run test:e2e
```

The browser tests start Vite in that host with only this add-on enabled, on port 5189. They do not start a backend. Chromium must be installed for Playwright, or set
`RACEHUBOS_TEST_BROWSER` to an existing Chromium executable. Selectors use `data-testid`.
Run the host's `npm run check`, `npm test -w @racehubos/backend` and
`npm test -w @racehubos/frontend` before submitting changes. Those backend tests must
always use the host script, which creates a throwaway database.

Test the core Simulator from Settings after installation. Physical CU race commands
and sustained race timing need hardware validation on each supported platform;
version/status reads were tested locally with a Prolific PL2303 and CU 5339.

Protocol references: [carreralib SerialConnection](https://github.com/tkem/carreralib/blob/master/src/carreralib/serial.py)
and [Node SerialPort](https://serialport.io/docs/guide-usage/).

License: AGPL-3.0-or-later, matching RaceHubOS. See LICENSE.
