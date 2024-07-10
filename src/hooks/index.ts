import { useCallback, useContext, useState } from "react";
import { ClientControllerContext } from "../controllers/client/ClientController";
import { ModalControllerContext } from "../controllers/modals/ModalController";
import { VoiceControllerContext } from "../controllers/voice/VoiceController";

export const useModal = () => useContext(ModalControllerContext);
export const useClient = () => useContext(ClientControllerContext);
export const useVoice = () => useContext(VoiceControllerContext);
export const useForceUpdate = () => {
    const [, forceUpdate] = useState(false);
    return useCallback(() => {
        forceUpdate(prev => !prev);
    }, []);
}
