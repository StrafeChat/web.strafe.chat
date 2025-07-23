import { createEffect, createSignal } from "solid-js";
import { api } from "../../../../lib/api";
import { InviteInfo } from "../../../../types/api";
import { getInviteCodes } from "../utils/invite";
import { MessageProps } from "../types";

export interface InviteState {
  code: string;
  loading: boolean;
  info?: InviteInfo;
  error?: string;
}

export function useInviteStates(props: MessageProps, cache: any) {
  const [inviteStates, setInviteStates] = createSignal<InviteState[]>([]);

  createEffect(async () => {
    const codes = getInviteCodes(props);
    if (codes.length === 0) {
      setInviteStates([]);
      return;
    }

    // Initialize with loading states
    setInviteStates(
      codes.map((code) => ({
        code,
        loading: true,
      })),
    );

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (!code) continue;

      try {
        let info = cache.getInvite(code);
        if (!info) {
          info = await cache.getInviteInfo(
            code,
            () => api.spaces.invites.getInfo(code) as Promise<InviteInfo>,
          );
        }

        setInviteStates((prev) =>
          prev.map((state, index) =>
            index === i ? { ...state, info, loading: false } : state,
          ),
        );
      } catch (e) {
        console.warn("Failed to fetch invite info for code:", code, e);
        setInviteStates((prev) =>
          prev.map((state, index) =>
            index === i
              ? { ...state, loading: false, error: "Invalid invite link" }
              : state,
          ),
        );
      }
    }
  });

  return inviteStates;
}
