import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react";
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class StatusModal extends Modal<{ statusText: string }, {}> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = { statusText: "" }; 

    render() {
        const { client } = this.context as { client: Client };

        const handleSubmit = (event: FormEvent) => {
            event.preventDefault();
            client.user?.setPresence({ status_text: this.state.statusText });
            this.close();
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
                        <div className='modal-window-wrapper'>
                            <div className="modal-window" style={{ width: "300px" }}>
                                <form onSubmit={handleSubmit}>
                                    <h1>Set a custom status</h1>
                                    <input 
                                        defaultValue={client.user?.presence.status_text} 
                                        onChange={(event) => this.setState({ statusText: event.target.value })}
                                    />
                                    <div className="flex justify-end gap-4 mt-2">
                                        <button type="button" onClick={() => this.close()}>Cancel</button>
                                        <button type="submit">Save</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </>
        )
    }
}

export default StatusModal;
