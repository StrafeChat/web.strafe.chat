import type { Component } from 'solid-js';
import { onMount } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { openRoomLink } from '../lib/openRoomLink';

/**
 * `/spaces/:spaceId/rooms/:roomId/:messageId` and `/rooms/:roomId/:messageId`: a message link
 * opened in a tab of its own (pasted, Ctrl-clicked, from outside the app). It opens the room
 * and jumps to the message the same way a click inside the app does, replacing this address
 * with the room's, or goes home with a notice when the room cannot be opened.
 */
const MessageLinkPage: Component = () => {
  const params = useParams<{ spaceId?: string; roomId: string; messageId: string }>();
  const navigate = useNavigate();
  onMount(() => {
    const link = { roomId: params.roomId, spaceId: params.spaceId ?? null, messageId: params.messageId };
    void openRoomLink(link, (path) => navigate(path, { replace: true })).then((opened) => {
      if (!opened) navigate('/', { replace: true });
    });
  });
  return <div class="flex-1" />;
};

export default MessageLinkPage;
