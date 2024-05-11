import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react";
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Button } from "@/components/ui/button";

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
                          <div className='modal-backdrop' onClick={() => this.close()}>
                            <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "350px" }}>
                                <form onSubmit={handleSubmit}>
                                    <h1>Set a custom status</h1>
                                    <p className="text-xs pt-4 pb-2 uppercase text-gray-300 font-bold">Custom Status</p>
                                    <input 
                                        defaultValue={client.user?.presence.status_text} 
                                        placeholder="Strafe.chat is so cool"
                                        onChange={(event) => this.setState({ statusText: event.target.value })}
                                    />
                                   <div className="flex gap-2 py-2 w-full">
                                        <Button type="submit" className="w-full bg-primary">Save</Button>
                                    </div>
                                </form>
                            </div>
                          </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </>
        )
    }
}

export default StatusModal;
