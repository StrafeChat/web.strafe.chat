"use client";
import { useUI } from "@/providers/UIProvider";
import { FaUserGroup, FaArrowRight, FaArrowLeft } from "react-icons/fa6";
import { useTranslation } from 'react-i18next';

export default function Friends() {

   const { setHideRoomList, hideRoomList } = useUI();
   const { t } = useTranslation();

   return (
    <>
    <div className="header-container">
      <div className="header">
        <span className="flex items-center gap-[3px]">
          {hideRoomList ? (
            <>
              <FaUserGroup onClick={() => setHideRoomList(!hideRoomList)} />
              <FaArrowRight className="!w-[12px] !h-[12px]" onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          ) : (
            <>
              <FaArrowLeft className="!w-[13px] !h-[13px]" onClick={() => setHideRoomList(!hideRoomList)} />
              <FaUserGroup onClick={() => setHideRoomList(!hideRoomList)} />
            </>
          )}
        </span>
        <span><b>{t('friends_page.header')}</b></span>
      </div>
      </div>
    </>
   )
}