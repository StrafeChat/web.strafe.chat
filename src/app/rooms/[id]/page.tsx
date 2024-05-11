"use client";
import { ChatHeader } from "@/components/chat";
import ChatBody from "@/components/chat/text/ChatBody";
import { useTranslation } from 'react-i18next';

export default function Page({ params }: { params: { id: string } }) {
  const { t } = useTranslation();

  return (
    <>
      <ChatHeader type="pm" name={params.id} />
      {/* <ChatBody room={params.id} /> */}
      {/* <ChatInput placeholder={t("pm_page.message_placeholder").replace(`{display_name}`, params.id)} /> */}
    </>
  );
}
