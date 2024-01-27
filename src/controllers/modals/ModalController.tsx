"use client";
import { ModalControllerState } from "@/types";
import { AnimatePresence } from "framer-motion";
import { Component, createContext } from "react";
import { ClientControllerContext } from "../client/ClientController";
import DeleteAccountModal from "./components/DeleteAccountModal";
import EditDataModal from "./components/EditDataModal";
import SettingsModal from "./components/SettingsModal";
import StatusModal from "./components/StatusModal";

export const ModalControllerContext = createContext({
    openModal: (_name: string, _data?: any) => { },
    closeModal: (_name: string) => { },
    modals: [] as {
        name: string;
        data?: any;
    }[]
});

export default class ModalController extends Component<{ children: JSX.Element }, ModalControllerState> {

    state = {
        openModals: [] as { name: string, data?: any }[]
    }

    static contextType = ClientControllerContext;

    openModal = (name: string, data?: any) => {
        this.setState((prevState) => ({
            openModals: [...prevState.openModals, { name, data }]
        }));
    };

    closeModal = (name: string) => {
        switch (name) {
            case "settings":
                if (this.state.openModals.find((modal) => modal.name == "edit-data")) return;
                else this.setState((prevState) => ({
                    openModals: prevState.openModals.filter((modal) => modal.name !== name)
                }));
                break;
            default:
                this.setState((prevState) => ({
                    openModals: prevState.openModals.filter((modal) => modal.name !== name)
                }));
        }
        // if(this.state.openModals.)
    };

    render() {
        return (
            <ModalControllerContext.Provider value={{ modals: this.state.openModals, openModal: this.openModal, closeModal: this.closeModal }}>
                <>
                    {this.state.openModals.map((modal, key) => {
                        switch (modal.name) {
                            case "settings":
                                return (
                                    <AnimatePresence key={key}>
                                        <SettingsModal name="settings" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "status":
                                return (
                                    <AnimatePresence key={key}>
                                        <StatusModal name="status" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "edit-data":
                                return (
                                    <AnimatePresence key={key}>
                                        <EditDataModal name="edit-data" closeModal={this.closeModal} data={modal.data} />
                                    </AnimatePresence>
                                )
                            case "delete-account":
                                return (
                                    <AnimatePresence key={key}>
                                        <DeleteAccountModal name="delete-account" closeModal={this.closeModal} />
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