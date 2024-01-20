import SettingsNotFound from "@/components/settings/SettingsNotFound";
import AccountSettings from "@/components/settings/user/AccountSettings";
import DesktopSettings from "@/components/settings/app/DesktopSettings";
import ProfileSettings from "@/components/settings/user/ProfileSettings";
import AuthorizedApps from "@/components/settings/user/AuthorizedAppsSettings";
import { AnimatePresence, motion } from "framer-motion";
import { 
  FaIdCard,
  FaUser,
  FaUserLock, 
  FaDesktop, 
  FaBell } from 'react-icons/fa6';
import Modal from './Modal';

const modalVariants = {
  open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
  closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class SettingsModal extends Modal<{}, {}> {

  state = {
    currentTab: "account"
  }

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
                  <li onClick={() => this.setState({ currentTab: "account" })}><FaUser /> &nbsp;&nbsp;My Account</li>
                  <li onClick={() => this.setState({ currentTab: "profile" })}><FaIdCard />&nbsp;&nbsp;Profile</li>
                  <li onClick={() => this.setState({ currentTab: "authorized-apps" })}><FaUserLock />&nbsp;&nbsp;Authorized Apps</li>
                  <hr />
                  <li className="title">APP Settings</li>
                  <li onClick={() => this.setState({ currentTab: "notifications" })}><FaBell />&nbsp;&nbsp;Notifications</li>
                  <li onClick={() => this.setState({ currentTab: "desktop" })}><FaDesktop />&nbsp;&nbsp;Desktop</li>
                </ul>
              </div>
              <button className="close" onClick={() => this.close()}>X</button>
              <div className="content">
                {(() => {
                  switch (this.state.currentTab) {
                    case "account":
                      return <AccountSettings />
                    case "profile":
                      return <ProfileSettings />
                    case "authorized-apps":
                      return <AuthorizedApps />
                    case "desktop":
                      return <DesktopSettings />  
                    default:
                      return <SettingsNotFound />
                  }
                })()}
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      </>
    )
  }
}

export default SettingsModal;
