import { useUI } from "@/providers/UIProvider";
import { VoiceHeaderProps } from "@/types";
import { FaArrowLeft, FaArrowRight, FaAt, FaHashtag, FaMagnifyingGlass, FaVolumeHigh } from 'react-icons/fa6';

export function VoiceHeader({ type, name, icon }: VoiceHeaderProps) {

    const { hideRoomList, setHideRoomList } = useUI();

    const Icon = icon;
    const icn = !Icon ? type == "pm" ? <FaAt onClick={() => setHideRoomList(!hideRoomList)} /> : <FaVolumeHigh onClick={() => setHideRoomList(!hideRoomList)} /> : <Icon onClick={() => setHideRoomList(!hideRoomList)} />

    return (
        <div className="header flex justify-between items-center">
            <span className="flex items-center gap-[3px]">
                {hideRoomList ? (
                    <>
                        {icn}
                        <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
                    </>
                ) : (
                    <>
                        <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
                        {icn}
                    </>
                )}
                <b className="pl-2">{name}</b>
            </span>
            <span className="flex gap-3 items-center text-2xl ml-1">
                <FaMagnifyingGlass />
            </span>
        </div>
    )
}