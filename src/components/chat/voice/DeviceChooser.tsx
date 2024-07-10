import { AnimatePresence, motion } from "framer-motion";

const modalVariants = {
  open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
  closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

export function DeviceChooser(props: {
  devices: MediaDeviceInfo[];
  res: (deviceId: string) => void;
}): JSX.Element {
  return (
    <AnimatePresence>
      <motion.div
        key="modal"
        initial="closed"
        animate="open"
        exit="closed"
        variants={modalVariants}
      >
        <div className='modal-window-wrapper'>
          <div className='modal-backdrop' onClick={() => props.res("default")}>
            <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "350px" }}>
              <h1>Choose a device</h1>
              <p className="text-xs pt-4 uppercase text-gray-300 font-bold">Devices</p>

              <>
                {props.devices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      props.res(device.deviceId);
                    }}
                  >
                    {device.label}
                  </button>
                ))}              
              </>
            </div>
          </div>
        </div>           
      </motion.div>
    </AnimatePresence>
  );
}