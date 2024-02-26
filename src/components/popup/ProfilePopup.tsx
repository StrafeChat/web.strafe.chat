import { useClient } from "@/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import Badges from "../Badges";
const { DateTime } = require('luxon');

export default function ProfilePopup({
  children,
  user,
}: {
  children: JSX.Element;
  user: any;
}) {

function formatDate(timpstamp: number) {
    const dt = DateTime.fromISO(timpstamp);
    return dt.toFormat('LLL d\'th\', yyyy');
}

  return (
    <Popover>
      <PopoverTrigger>{children}</PopoverTrigger>
      <PopoverContent side="right">
        <div className="h-fit rounded-t-xl">
          <div
            className="h-[60px] rounded-t-xl"
            style={{
              backgroundColor: `gray`, // accentColor
            }}
          />
          <div className="absolute top-[1.5rem] px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              draggable={false}
              src={`${process.env.NEXT_PUBLIC_CDN}/avatars/${user.id}/${user.avatar}`}
              width={80}
              height={80}
              className="avatar_modal"
              alt="avatar"
            />
          </div>
          <div className="flex justify-end py-4 px-1.5">
            {user.flags > 0 ? (
              <div className="p-2 bg-black flex gap-2 rounded-xl">
                <Badges flags={user.flags} />
              </div>
            ) : (
              <div className="p-4"></div>
            )}
          </div>
          <div className="w-full px-2 h-fit pb-2">
            <div className="w-full bg-black px-4 py-2 rounded-xl">
              <span className="text-xl font-bold block">
               {user.global_name}
              </span>
              <span
                className="text-base font-bold block cursor-pointer"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${user.username}#${user.discriminator
                      .toString()
                      .padStart(4, "0")}`
                  )
                }
              >
              {user.username}#{user.discriminator.toString().padStart(4, "0")}
              </span>
              <span className="text-gray-400">{user.presence.status_text}</span>
              <div className="w-full h-0.5 bg-gray-500 rounded-full my-2" />
              <span className="text-sm font-bold block mt-1">ABOUT</span>
               {user.about ? (
                <span>{user.about}</span>
              ) : (
                <span className="text-gray-400">No About Provided</span>
              )} 
              <span className="text-sm font-bold block mt-2">MEMBER SINCE</span>
                <span className="text-gray-400">{formatDate(user.created_at)}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}