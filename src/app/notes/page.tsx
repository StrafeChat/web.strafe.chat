"use client";
import { useUI } from "@/providers/UIProvider";
import { FaNoteSticky, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';

export default function Notes() {

   const { hideRoomList, setHideRoomList } = useUI();
   const { t } = useTranslation();

   return (
    <>
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaNoteSticky onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>{t('notes_page.header')}</b></span>
      </div>
    </>
   )
}