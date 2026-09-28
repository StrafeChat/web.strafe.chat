import type { Component } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { auth } from '../../stores/auth';
import { acceptIncomingCall, declineIncomingCall, voice } from '../../stores/voice';
import { rooms, roomDisplayName } from '../../stores/rooms';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { Button } from '../ui/Button';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { zLayer } from '../../theme/appChrome';
import { t } from '../../i18n';

/** Rings while someone calls this account; accept joins the call and opens the room. */
export const IncomingCallModal: Component = () => {
  const navigate = useNavigate();
  const inc = () => voice.incoming;
  const room = createMemo(() => rooms.rooms.find((r) => r.id === inc()?.roomId));
  const caller = createMemo(() => room()?.participants?.find((p) => p.id === inc()?.startedBy));
  const callerName = () => caller()?.display_name || caller()?.username || t('common.someone');
  const isGroup = () => room()?.type === 2;
  const roomName = () => (room() && auth.user?.id ? roomDisplayName(room()!, auth.user.id) : '');

  async function accept(video: boolean) {
    const rid = inc()?.roomId;
    await acceptIncomingCall(video).catch((err) => console.error('Accept call failed:', err));
    if (rid) navigate(`/rooms/${rid}`);
  }

  return (
    <Show when={inc()}>
      <ResponsiveDialog
        size="sm"
        zClass={zLayer.critical}
        onClose={() => void declineIncomingCall()}
        centered
        labelledBy="incoming-call-title"
      >
        <div class="flex flex-col items-center gap-4 text-center" data-incoming-call>
          <span class="relative">
            <span class="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden="true" />
            <MessageAvatar name={callerName()} avatar={caller()?.avatar} class="relative size-20 text-2xl" />
          </span>
          <div>
            <h2 id="incoming-call-title" class="text-lg font-semibold text-foreground">
              {t('voice.incoming.title')}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {isGroup() ? t('voice.incoming.group', { name: callerName(), room: roomName() }) : t('voice.incoming.from', { name: callerName() })}
            </p>
          </div>
          <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="destructive" onClick={() => void declineIncomingCall()}>
              <i class="fa-solid fa-phone-slash text-xs" aria-hidden="true" />
              {t('voice.incoming.decline')}
            </Button>
            <Button variant="outline" onClick={() => void accept(true)}>
              <i class="fa-solid fa-video text-xs" aria-hidden="true" />
              {t('voice.incoming.acceptVideo')}
            </Button>
            <Button class="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void accept(false)}>
              <i class="fa-solid fa-phone text-xs" aria-hidden="true" />
              {t('voice.incoming.accept')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
