import SettingsNotFound from "@/components/settings/SettingsNotFound";
import DesktopSettings from "@/components/settings/app/DesktopSettings";
import AccountSettings from "@/components/settings/user/AccountSettings";
import NotificationSettings from "@/components/settings/user/NotificationSettings";
import { AnimatePresence, motion } from "framer-motion";
import cookie from "js-cookie";
import {
  FaBell,
  FaDesktop,
  FaIdCard,
  FaRightFromBracket,
  FaUser,
  FaUserLock
} from 'react-icons/fa6';
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

    const logout = () => {
      cookie.remove("token");
      this.close();
      window.location.href = "/login";
    }

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
                  <li className={this.state.currentTab === "account" ? "active" : ""} onClick={() => this.setState({ currentTab: "account" })}><FaUser /> &nbsp;&nbsp;My Account</li>
                  <li className={this.state.currentTab === "profile" ? "active" : ""} onClick={() => this.setState({ currentTab: "profile" })}><FaIdCard />&nbsp;&nbsp;Profile</li>
                  <li className={this.state.currentTab === "authorized-apps" ? "active" : ""} onClick={() => this.setState({ currentTab: "authorized-apps" })}><FaUserLock />&nbsp;&nbsp;Authorized Apps</li>
                  <hr />
                  <li className="title">App Settings</li>
                  <li className={this.state.currentTab === "notifications" ? "active" : ""} onClick={() => this.setState({ currentTab: "notifications" })}><FaBell />&nbsp;&nbsp;Notifications</li>
                  <li className={this.state.currentTab === "desktop" ? "active" : ""} onClick={() => this.setState({ currentTab: "desktop" })}><FaDesktop />&nbsp;&nbsp;Desktop</li>
                  <hr />
                  <li onClick={() => logout()} className="!text-destructive"><FaRightFromBracket />&nbsp;&nbsp; Logout</li>
                </ul>
              </div>
              <button className="close" onClick={() => this.close()}>X</button>
              <div className="content">
                {(() => {
                  switch (this.state.currentTab) {
                    case "account":
                      return <AccountSettings />
                    // case "profile":
                    //   return <ProfileSettings />
                    // case "authorized-apps":
                    //   return <AuthorizedApps />
                    case "notifications":
                      return <NotificationSettings />
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
