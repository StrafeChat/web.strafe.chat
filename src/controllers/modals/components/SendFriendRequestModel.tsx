import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 

import Modal from './Modal';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class SendFriendRequestModal extends Modal<{ username: string, discriminator: number }, {}> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = { username: "", discriminator: 0 };

    render() {
        const { client } = this.context as { client: Client };

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            const result = await client!.user!.sendFriendRequest(this.state.username, this.state.discriminator);
            if (!result.ok) {
              toast({
                title: "Error",
                description: result.message,
                duration: 5000,
                variant: "destructive"
              })
            } else {
              (event.target as HTMLFormElement).reset();
            }
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
                                    <h1>Add Friend</h1>
                                    <p className="text-xs pt-4 pb-2 uppercase text-gray-300 font-bold">Username</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            placeholder="username"
                                            onChange={(event) => this.setState({ username: event.target.value })}
                                            style={{ flexGrow: 1 }}
                                            required
                                        />
                                        <input
                                            placeholder="1234"
                                            onChange={(event) => this.setState({ discriminator: parseInt(event.target.value) })}
                                            style={{ width: "60px" }}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-2 py-2 w-full pt-4 rounded-[20px]">
                                       <Button type='submit' className='w-full bg-primary font-bold hover:opacity-55'>Send</Button>
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

export default SendFriendRequestModal;