import { OverviewSettings, SettingsNotFound } from "@/components/spaces/settings";
import { AnimatePresence, motion } from "framer-motion";
import { Client } from "@strafechat/strafe.js";
import {
  FaBell,
  FaIdCard,
  FaCircleInfo,
  FaTrashCan,
  FaFaceSmile,
  FaClock,
  FaFlag
} from 'react-icons/fa6';
import Modal from './Modal';
import { ClientControllerContext } from "@/controllers/client/ClientController";

const modalVariants = {
  open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
  closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class SpaceSettingsModal extends Modal<{}, { data: { spaceId: string } }> {
    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

  state = {
    currentTab: "overview"
  }

  render() {
    const { client } = this.context as { client: Client };
    let space = client.spaces.get(this.props.data.spaceId);
    if (!space) return <h1>huh? I'm confused.</h1>
   
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
                  <li className="title">{space.name}</li>
                  <li className={this.state.currentTab === "overview" ? "active" : ""} onClick={() => this.setState({ currentTab: "overview" })}><FaCircleInfo /> &nbsp;&nbsp;Overview</li>
                  <li className={this.state.currentTab === "roles" ? "active" : ""} onClick={() => this.setState({ currentTab: "roles" })}><FaFlag />&nbsp;&nbsp;Roles</li>
                  <li className={this.state.currentTab === "emojis" ? "active" : ""} onClick={() => this.setState({ currentTab: "emojis" })}><FaFaceSmile />&nbsp;&nbsp;Emojis</li>
                  <hr />
                  <li className="title">Moderation</li>
                  <li className={this.state.currentTab === "audit-log" ? "active" : ""} onClick={() => this.setState({ currentTab: "audit-log" })}><FaClock />&nbsp;&nbsp;Audit Log</li>
                  <hr />
                  <li className="!text-destructive"><FaTrashCan />&nbsp;&nbsp;Delete Space</li>
                </ul>
              </div>
              <button className="close" onClick={() => this.props.closeModal("space-settings")}>X</button>
              <div className="content">
                {(() => {
                  switch (this.state.currentTab) {
                    case "overview":
                        return <OverviewSettings />
                    //   case "roles":
                    //     return <RoleSettimgs />
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

export default SpaceSettingsModal;
