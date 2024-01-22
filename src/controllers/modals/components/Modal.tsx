import { ModalState } from '@/types';
import { Component, Context } from 'react';
import "../modals.scss";
import { ClientControllerContext } from '@/controllers/client/ClientController';

export default class Modal<Props, State> extends Component<ModalState & State, Props> {

    constructor({ props }: { props: ModalState & State }) {
        super(props);
    }
    
    
    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.key.toLowerCase() == "escape") this.close();
    }

    componentDidMount(): void {
        window.addEventListener("keydown", this.handleKeyDown);
    }

    componentWillUnmount(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
    }

    close() {
        this.props.closeModal(this.props.name);
    }
}