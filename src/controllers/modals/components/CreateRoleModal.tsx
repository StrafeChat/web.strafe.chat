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

class CreateRoleModal extends Modal<{ roleName: string }, { data: { spaceId: string } }> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = { roleName: "" };

    render() {
        const { client } = this.context as { client: Client };

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            const space = client.spaces.get(this.props.data.spaceId);
            // await space!.roles.create({ name: this.state.roleName, type: 0, space_id: space?.id, });
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
                                    <h1>Create Role</h1>
                                    <p className="text-xs pt-4 pb-2 uppercase text-gray-300 font-bold">Role Name</p>
                                    <input
                                        placeholder="Information"
                                        onChange={(event) => this.setState({ roleName: event.target.value })}
                                    />
                                     <div className="flex gap-2 py-2 w-full pt-4 rounded-[20px]">
                                       <Button type='submit' className='w-full bg-primary font-bold hover:opacity-55'>Create</Button>
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

export default CreateRoleModal;