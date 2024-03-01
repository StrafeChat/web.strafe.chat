import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 

import Modal from './Modal';

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class CreateRoomModal extends Modal<{ roomName: string, roomType: number }, { data: { spaceId: string } }> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = { roomName: "", roomType: 1 };

    render() {
        const { client } = this.context as { client: Client };

        const handleSubmit = async (event: FormEvent) => {
            event.preventDefault();
            console.log(this.props.data.spaceId)
            const space = client.spaces.get(this.props.data.spaceId);
            await space!.rooms.create({ name: this.state.roomName, type: this.state.roomType, space_id: space?.id, });
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
                            <div className="modal-window" style={{ width: "350px" }}>
                                <form onSubmit={handleSubmit}>
                                    <h1>Create Room</h1>
                                    <div className="room-type-selection">
                                        <p className="text-xs pt-4 uppercase text-gray-300 font-bold">Room Type</p>
                                           <div className={`roomType ${this.state.roomType === 1 ? "checked" : ""} `}
                                            onClick={() => this.setState({ roomType: 1 })}>
                                            Text
                                            </div>
                                            <div className={`roomType ${this.state.roomType === 2 ? "checked" : ""} `}
                                             onClick={() => this.setState({ roomType: 2 })} >
                                            Voice
                                            </div>
                                    </div>
                                    <p className="text-xs py-2 uppercase text-white font-bold">Room Name</p>
                                    <input
                                        placeholder="General"
                                        onChange={(event) => this.setState({ roomName: event.target.value })}
                                    />
                                    <div className="flex justify-end gap-4 mt-4 ">
                                        <button type="button" onClick={() => this.close()}>Cancel</button>
                                        <button type="submit">Create Room</button>
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

export default CreateRoomModal;
