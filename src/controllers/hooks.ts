import { useCallback, useContext, useState } from "react";
import { ModalControllerContext } from "./modals/ModalController";
import { ClientControllerContext } from "./client/ClientController";

export const useModal = () => useContext(ModalControllerContext);
export const useClient = () => useContext(ClientControllerContext);
export const useForceUpdate = () => {
    const [, forceUpdate] = useState(0);
    return useCallback(() => {
        forceUpdate((prev) => prev + 1);
    }, []);
}