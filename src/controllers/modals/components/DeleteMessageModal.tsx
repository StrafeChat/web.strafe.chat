import { MessageComponent } from "@/components/chat/text/messages/Message";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 

import Modal from './Modal';
import { Button } from "@/components/ui/button";
import { Message } from "@strafechat/strafe.js";

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class DeleteMessageModal extends Modal<{}, { data: { message: Message } }> {

    render() {

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            await this.props.data.message.delete();
            this.close();
        }

        const message = this.props.data.message;

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
                            <div className="modal-window" onClick={(e) => e.stopPropagation()} style={{ width: "425px" }}>
                                <form onSubmit={handleSubmit}>
                                    <h1>Delete Message</h1>
                                    <p className="text-xs py-2 text-gray-200">Are you sure you want to delete this message?</p>
                                       <div className="message-delete">
                                          <MessageComponent key={0} message={message} sameAuthor={false} showMoreOptions={false} />
                                       </div>
                                       <div className="flex gap-2 py-2 w-full pt-4 rounded-[20px]">
                                      <Button type="submit" className="w-full bg-red-500 pt-5 hover:bg-red-500 hover:opacity-55">Delete</Button>
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

export default DeleteMessageModal;
