"use client";
import { Button } from "@/components/ui/button";
import { useClient } from "@/hooks";
import { useRouter } from "next/navigation";
import { Invite } from "@strafechat/strafe.js/dist/structure/Invite";
import { User } from "@strafechat/strafe.js/dist/structure/User";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Formatting } from "@/helpers/formatter";

export default function Page({ params }: { params: { code: string } }) {
  const { t } = useTranslation();
  const { client } = useClient();
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null | undefined>(null)
  const [inviter, setInviter] = useState<User | null | undefined>(null)
  const [invaildInvite, setInvaildInvite] = useState<boolean>(false)

  const fetchInvite = useCallback(async () => {
    const invite = await client?.invites.fetch(params.code);
      if (invite) {
        const inviter = await client?.users.fetch(invite!.inviterId);
        setInviter(inviter);
        return setInvite(invite);
    } else if (!invite) return setInvaildInvite(true);
  }, []);

  const fetchInviteCalled = useRef(false);
 
  useEffect(() => {
    if (!fetchInviteCalled.current) {
      fetchInvite();
      fetchInviteCalled.current = true;
    }
  }, [fetchInvite]);

  useEffect(() => {
    setTimeout(() => {
    }, 500)
  }, [invite]);

  if (invaildInvite) return <p>Invaild Invite</p>;

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex flex-col">
    <div className="top-0 left-0 fixed z-50 p-4 flex flex-col items-center">
      <button onClick={handleGoBack}>
        <FontAwesomeIcon size="2x" icon={faArrowLeft} />
      </button>
    </div>
    <div className="flex-1 flex items-center justify-center bg-background text-white">
      <div className="bg-secondary rounded-md px-8 py-5 items-center min-w-[275px] flex flex-col justify-center text-center">
        <div className="flex items-center justify-center">
          {
            invite?.space.icon ? (
              <img src={invite?.space.icon} alt="Space Icon" className="w-16 h-16" />
            ) : (
              <p className="text-16 bg-background rounded-full text-center py-5 w-16 h-16">{invite?.space.name_acronym}</p>
            )
          }
        </div>
        <div className="mt-2 text-center">
          <h1 className="text-2xl font-semibold">{invite?.space.name}</h1>
          <p className="mt-1">{invite?.space.description}</p>
          <p>{invite?.memberCount} members</p>
          <p>Invited by {inviter?.avatar && <img className="rounded-full h-6 w-6 inline-block mx-1" src={Formatting.formatAvatar(inviter.id, inviter.avatar)}></img>} {inviter?.displayName}</p>
          <Button className="mt-5 text-white secondary"><b>Accept Invite</b></Button>
        </div>
      </div>
    </div>
  </div>  
  );
}
