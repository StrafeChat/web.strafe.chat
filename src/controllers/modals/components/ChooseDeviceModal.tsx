import { AnimatePresence, motion } from "framer-motion";

import Modal from './Modal';
import { Button } from "@/components/ui/button";

const modalVariants = {
  open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
  closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

export default class ChooseDeviceModal extends Modal<{ }, { data: { devices: MediaDeviceInfo[]} }> {
  render() {
    //const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
    console.log(this.props.data.devices);
    return (
      <>
    <AnimatePresence>
      <motion.div initial="closed" animate="open" exit="closed" variants={modalVariants}>
          <div className='modal-window-wrapper'>
            <div className='modal-backdrop' onClick={() => this.close("strafechat-cancel")}>
              <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "fit-content", maxWidth: "75%" }}>
                <h1 style={{textAlign: "center"}}>Choose Audio Input</h1>
                <br></br>
                <ul>
                  {
                    this.props.data.devices.map((device, index) => (
                      <li key={device.deviceId}>
                        <Button onClick={() => this.close(device.deviceId)} style={{ width: "100%" }}>{(device.label.length > 0) ? device.label : (index + ".")}</Button>
                      </li>
                    ))
                  }
                </ul>
              </div>
            </div>
          </div>
      </motion.div>
    </AnimatePresence>
    </>
    )
  }
}