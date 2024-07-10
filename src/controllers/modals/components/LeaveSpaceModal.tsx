import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 

import Modal from './Modal';
import { Button } from "@/components/ui/button";

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class LeaveSpaceModal extends Modal<{}, { data: { spaceId: string } }> {
    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    render() {
        const { client } = this.context as { client: Client };
        const space = client.spaces.get(this.props.data.spaceId);

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            await space!.leave();
            client.spaces.delete(space!.id);
            this.close();
            window.history.pushState({}, '', '/');
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
                                    <h1>Leave {space?.name}?</h1>
                                    <p className="text-xs py-2 text-gray-200">Are you sure you want to leave <b>{space?.name}</b>? You will not be able to join without another invite.</p>
                                    <div className="flex gap-2 py-2 w-full">
                                        <Button type="submit" className="w-full bg-red-500 pt-5 hover:bg-red-500 hover:opacity-55">Leave</Button>
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

export default LeaveSpaceModal;
