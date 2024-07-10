import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 

import Modal from './Modal';

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class DeleteRoomModal extends Modal<{}, { data: { spaceId: string, roomId: string } }> {
    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    render() {
        const { client } = this.context as { client: Client };
        const space = client.spaces.get(this.props.data.spaceId);
        const room = space?.rooms.get(this.props.data.roomId)

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            await room!.delete();
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
                                    <p className="text-xs py-2 text-gray-200">Are you sure you want to delete <b>{room?.name}</b>? This move cannot be un-done :/</p>
                                    <div className="flex justify-end gap-4 mt-4 ">
                                        <button type="button" onClick={() => this.close()}>Cancel</button>
                                        <button type="submit" className="bg-red-500">Delete</button>
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

export default DeleteRoomModal;
