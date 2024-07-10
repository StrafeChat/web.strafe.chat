import { ClientControllerContext } from "@/controllers/client/ClientController";
import { Client, Invite, Space } from "@strafechat/strafe.js";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent } from "react"; 
import Modal from './Modal';
import { Button } from "@/components/ui/button";

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class CreateInviteModal extends Modal<{ maxUses: number | null, expiresAt: number | null, invite: Invite | null, space: Space | null }, { data: { spaceId: string } }> {

    static contextType = ClientControllerContext;
    context!: React.ContextType<typeof ClientControllerContext>;

    state = { 
        maxUses: null, 
        expiresAt: null,
        invite: null as Invite | null,
        space: null as Space | null 
    };

    componentDidMount() {
        const { client } = this.context as { client: Client };
        const space = client.spaces.get(this.props.data.spaceId);
        this.setState({ space });
    }

    handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const { space } = this.state;
        if (space) {
            let room = this.state.space!.rooms.toArray().filter(room => [1,  2].includes(room.type))[0]
            if (room) {
                let invite = await room.createInvite();
                this.setState({ invite });
            } else {
                console.error("This space has no rooms in order to create an invite.")
            }
        }
    }

    copyToClipboard = () => {
        if (this.state.invite) {
            navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_DOMAIN}/invites/${this.state.invite.code}`);
            return this.close();
        }
    };

    render() {
        const { invite, space } = this.state;
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
                                    {this.state.invite ? (
                                        <>
                                            <h1>Invite people to {space?.name}.</h1>
                                            <p className="text-xs pt-4 pb-2 uppercase text-gray-300 font-bold">Invite Link</p>
                                              <input
                                                type="text"
                                                value={`${process.env.NEXT_PUBLIC_DOMAIN}/invites/${invite?.code}`}
                                                readOnly={true}
                                              />
                                               <div className="flex gap-2 py-2 w-full pt-5 rounded-[20px]">
                                                <Button onClick={this.copyToClipboard} className='w-full bg-primary font-bold hover:opacity-55'>Copy Link</Button>
                                              </div>
                                        </>
                                    ) : (
                                        <form onSubmit={this.handleSubmit}>
                                            <h1>Invite people to {space?.name}.</h1>
                                            <p className="text-xs pt-4 pb-2 uppercase text-gray-300 font-bold">Max Uses</p>
                                            <input
                                                placeholder="No Limit"
                                                type="number"
                                                onChange={(event) => this.setState({ maxUses: parseInt(event.target.value) })}
                                            />
                                            <p className="text-xs py-2 uppercase text-white font-bold">Expires At</p>
                                            <input
                                                placeholder="Never Expires"
                                                type="number"
                                                onChange={(event) => this.setState({ expiresAt: parseInt(event.target.value) })}
                                            />
                                            <div className="flex gap-2 py-2 w-full pt-5 rounded-[20px]">
                                                <Button type='submit' className='w-full bg-primary font-bold hover:opacity-55'>Create</Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </>
        )
    }
}

export default CreateInviteModal;
