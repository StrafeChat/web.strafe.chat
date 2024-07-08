"use client";
import { ModalControllerState } from "@/types";
import { AnimatePresence } from "framer-motion";
import { Component, createContext } from "react";
import { ClientControllerContext } from "../client/ClientController";
import DeleteAccountModal from "./components/DeleteAccountModal";
import EditDataModal from "./components/EditDataModal";
import SettingsModal from "./components/SettingsModal";
import StatusModal from "./components/StatusModal";
import CreateSpaceModal from "./components/CreateSpaceModal";
import CreateRoomModal from "./components/CreateRoomModal";
import CreateSectionModal from "./components/CreateSectionModal";
import SpaceSettingsModal from "./components/SpaceSettingsModal";
import LeaveSpaceModal from "./components/LeaveSpaceModal";
import CreateInviteModal from "./components/CreateInviteModal";
import DeleteMessageModal from "./components/DeleteMessageModal";
import ChooseDeviceModal from "./components/ChooseDeviceModal";
import { EventEmitter } from "events";

export const ModalControllerContext = createContext({
    openModal: (_name: string, _data?: any,) => { },
    closeModal: (_name: string) => { },
    openCustomModal: (_name: string, element: JSX.Element) => { },
    openCallbackModal: (_name: string, _data: any) => new Promise((res: any) => res),
    modals: [] as {
        name: string;
        data?: any | JSX.Element;
    }[]
});

export default class ModalController extends Component<{ children: JSX.Element }, ModalControllerState> {

    state = {
        openModals: [] as { name: string, data?: any | JSX.Element, }[]
    }

    private emitter = new EventEmitter();

    static contextType = ClientControllerContext;
    openModal = (name: string, data?: any,) => {
        this.setState((prevState) => ({
            openModals: [...prevState.openModals, { name, data }]
        }));
    };

    closeModal = (name: string, data?: any) => {
        switch (name) {
            case "settings":
                if (this.state.openModals.find((modal) => modal.name == "edit-data")) return;
                else this.setState((prevState) => ({
                    openModals: prevState.openModals.filter((modal) => modal.name !== name)
                }));
                break;
                case "space-settings":
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
        if (data) {
          this.emitter.emit("callback", { name, data });
        }
        // if(this.state.openModals.)
    };

    openCallbackModal = (name: string, d: any) => {
      return new Promise((res) => {
        this.openModal(name, d);
        const listener = (data: any) => {
          if (data.name !== name) return;
          this.emitter.off("callback", listener);
          res(data.data);
        }
        this.emitter.on("callback", listener);
      });
    }

    openCustomModal = (name: string, element: JSX.Element) => {
      // TODO:
      this.setState((prevState) => ({
        openModals: [...prevState.openModals, { name, data: element, custom: true }]
      }));
    }

    render() {
        return (
            <ModalControllerContext.Provider value={{ modals: this.state.openModals, openModal: this.openModal, closeModal: this.closeModal, openCustomModal: this.openCustomModal, openCallbackModal: this.openCallbackModal }}>
                <> 
                    {this.state.openModals.map((modal, key) => {
                        switch (modal.name) {
                            case "settings":
                                return (
                                    <AnimatePresence key={key}>
                                        <SettingsModal name="settings" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "space-settings":
                                return (
                                    <AnimatePresence key={key}>
                                        <SpaceSettingsModal name="space-setings" closeModal={this.closeModal} data={modal.data!} />
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
                                );
                            case "delete-account":
                                return (
                                    <AnimatePresence key={key}>
                                        <DeleteAccountModal name="delete-account" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "create-space":
                                return (
                                    <AnimatePresence key={key}>
                                        <CreateSpaceModal name="create-space" closeModal={this.closeModal} />
                                    </AnimatePresence>
                                );
                            case "create-room":
                                return (
                                    <AnimatePresence key={key}>
                                        <CreateRoomModal name="create-room" closeModal={this.closeModal} data={modal.data!}/>
                                    </AnimatePresence>
                                );    
                            case "create-section":
                                return (
                                    <AnimatePresence key={key}>
                                        <CreateSectionModal name="create-section" closeModal={this.closeModal} data={modal.data!}/>
                                    </AnimatePresence>
                                );  
                            case "leave-space":
                                return (
                                    <AnimatePresence key={key}>
                                        <LeaveSpaceModal name="leave-space" closeModal={this.closeModal} data={modal.data!}/>
                                    </AnimatePresence>
                                );    
                            case "create-invite":
                                return (
                                    <AnimatePresence key={key}>
                                        <CreateInviteModal name="create-invite" closeModal={this.closeModal} data={modal.data!}/>
                                    </AnimatePresence>
                                );      
                            case "delete-message":
                                return (
                                    <AnimatePresence key={key}>
                                        <DeleteMessageModal name="delete-message" closeModal={this.closeModal} data={modal.data!}/>
                                    </AnimatePresence>
                                );  
                            case "choose-device":
                                return (
                                  <AnimatePresence>
                                    <ChooseDeviceModal name="choose-device" closeModal={this.closeModal} data={modal.data!}></ChooseDeviceModal>
                                  </AnimatePresence>
                                );
                            default:
                              return modal.data;
                        }
                    })}
                </>
                {this.props.children}
            </ModalControllerContext.Provider>
        );
    }
}