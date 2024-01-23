import { useCallback, useContext, useState } from "react";
import { ClientControllerContext } from "../controllers/client/ClientController";
import { ModalControllerContext } from "../controllers/modals/ModalController";

export const useModal = () => useContext(ModalControllerContext);
export const useClient = () => useContext(ClientControllerContext);
export const useForceUpdate = () => {
    const [, forceUpdate] = useState(0);
    return useCallback(() => {
        forceUpdate((prev) => prev + 1);
    }, []);
}