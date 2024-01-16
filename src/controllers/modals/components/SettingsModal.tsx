import { AnimatePresence, motion } from "framer-motion";
import Modal from './Modal';

const modalVariants = {
  open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
  closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class SettingsModal extends Modal {
  render() {
    return (
      <>
        <AnimatePresence>
          <motion.div
            key="modal"
            initial="closed"
            animate="open"
            exit="closed"
            variants={modalVariants}
          >
            <div className='modal-full'>
              <div className="sidebar">
                <ul>
                  <li className="title">User Settings</li>
                  <li>My Account</li>
                  <li>Profile</li>
                  <li>Desktop</li>
                </ul>
              </div>
              <button className='close' onClick={() => this.close()}>X</button>
              <div className="content">
                <h1 className="title">My Account</h1>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      </>
    )
  }
}

export default SettingsModal;
