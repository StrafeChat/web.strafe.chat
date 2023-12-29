import "../modals.scss";
import { ModalState } from '@/types';
import { Component, useEffect } from 'react'

export default class Modal extends Component<ModalState> {

    constructor({ props }: { props: ModalState }) {
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