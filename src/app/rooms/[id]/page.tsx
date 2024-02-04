"use client";
import { ChatBody, ChatHeader, ChatInput } from "@/components/chat";
import { useTranslation } from 'react-i18next';

export default function Page({ params }: { params: { id: string } }) {
  const { t } = useTranslation();

  return (
    <>
      <ChatHeader type="pm" name={params.id} />
      <ChatBody />
      <ChatInput placeholder={t("pm_page.message_placeholder").replace(`{display_name}`, params.id)} />
    </>
  );
}
