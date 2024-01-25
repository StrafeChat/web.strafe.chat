import { AnimatePresence, motion } from "framer-motion";
import { Dispatch, FormEvent, SetStateAction } from "react";
import Modal from './Modal';

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class EditDataModel extends Modal<{ data: string }, { data: { title: string, defaultValue: string, type: string, set: Dispatch<SetStateAction<any>> } }> {

    constructor(props: any) {
        super(props);
    }

    state = {
        data: ""
    }

    render() {

        const handleSubmit = (event: FormEvent) => {
            event.preventDefault();
            this.props.data.set(this.state.data);
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
                                    <h1>{this.props.data.title}</h1>
                                    <input defaultValue={this.props.data.defaultValue} onChange={(event) => this.setState({ data: event.target.value })} />
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

export default EditDataModel;
