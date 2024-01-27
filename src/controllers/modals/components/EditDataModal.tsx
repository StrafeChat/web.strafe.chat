import { AnimatePresence, motion } from "framer-motion";
import { Dispatch, FormEvent, SetStateAction } from "react";
import Modal from './Modal';

const modalVariants = {
    open: { opacity: 1, transition: { ease: "backIn", duration: 0.3, x: { duration: 1 } } },
    closed: { opacity: 0, transition: { ease: "backOut", duration: 0.3, x: { duration: 1 } } },
};

class EditDataModel extends Modal<{ data: any[] }, { data: { title: string, inputs: (React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & { set: Dispatch<SetStateAction<any>> })[] } }> {

    constructor(props: any) {
        super(props);
    }

    state = {
        data: []
    }

    render() {
        const handleSubmit = (event: FormEvent) => {
            event.preventDefault();

            for (const input of this.props.data.inputs) {
                input.set(this.state.data[this.props.data.inputs.indexOf(input)]);
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
                            <div className="modal-window" style={{ width: "300px" }}>
                                <form onSubmit={handleSubmit}>
                                    <h1>{this.props.data.title}</h1>
                                    <div className="flex flex-col gap-2 py-2">
                                        {this.props.data.inputs.map((input, index) => {
                                            return (
                                                <div key={index}>
                                                    <label>{input.placeholder}</label>
                                                    <input {...input} onChange={(event) => this.setState({ data: [...this.state.data.slice(0, index), event.target.value, ...this.state.data.slice(index + 1)] })} />
                                                </div>
                                            )
                                        })}
                                    </div>
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
