"use client";
import { ModalControllerState } from "@/types";
import { AnimatePresence } from "framer-motion";
import { Component, createContext, useContext } from "react";
import SettingsModal from "./components/SettingsModal";
import StatusModal from "./components/StatusModal";

export const ModalControllerContext = createContext({
    openModal: (_name: string) => { },
    closeModal: (_name: string) => { },
});

export default class ModalController extends Component<{ children: JSX.Element }, ModalControllerState> {
    state = {
        openModals: []
    };

    openModal = (name: string) => {
        this.setState((prevState) => ({
            openModals: [...prevState.openModals, name]
        }));
    };

    closeModal = (name: string) => {
        this.setState((prevState) => ({
            openModals: prevState.openModals.filter((modalName) => modalName !== name)
        }));
    };

    render() {
        return (
            <ModalControllerContext.Provider value={{ openModal: this.openModal, closeModal: this.closeModal }}>
                <>
                    {this.state.openModals.map((name, key) => {
                        switch (name) {
                            case "settings":
                                return (
                                    <AnimatePresence key={key}>
                                        <SettingsModal key={key} name="settings" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "status":
                                return (
                                    <AnimatePresence key={key}>
                                        <StatusModal key={key} name="status" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                        }
                    })}
                </>
                {this.props.children}
            </ModalControllerContext.Provider>
        );
    }
}