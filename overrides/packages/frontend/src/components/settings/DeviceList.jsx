export * from '@base';
import BaseDeviceList from '@base';
import UsbDevices from '@addon/web/UsbDevices.jsx';

export default function DeviceList(props) {
  return (
    <>
      <BaseDeviceList {...props} />
      <UsbDevices {...props} />
    </>
  );
}
