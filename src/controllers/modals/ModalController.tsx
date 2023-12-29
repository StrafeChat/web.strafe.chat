"use client";
import { ModalControllerState } from "@/types";
import { AnimatePresence } from "framer-motion";
import { Component, createContext, useContext } from "react";
import SettingsModal from "./components/SettingsModal";

const ModalControllerContext = createContext({
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
                 {AnimatePresence}
                    {this.state.openModals.map((name, key) => {
                        switch (name) {
                            case "settings":
                                return (
                                  <AnimatePresence key={key}>
                                    <SettingsModal key={key} name="settings" closeModal={this.closeModal} />
                                  </AnimatePresence>
                                ) 
                        }
                    })}
                </>
                {this.props.children}
            </ModalControllerContext.Provider>
        );
    }
}

export const useModalController = () => useContext(ModalControllerContext);