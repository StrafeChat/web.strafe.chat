import { IRoom } from "@strafechat/strafe.js";

export default function ChatBody(props: { room: IRoom }) {
   const room = props.room;

    return (
        <div className="body">
           <ul className="messages flex min-w-[5px] h-full flex-col justify-end pt-[25px]">
           <div className="pb-7 px-[20px]">
              <h1 className="text-2xl font-bold inline-flex items-center">
                  Welcome to #{room.name}
              </h1>
              <p className="text-base">
                This is the start of the room. {room.topic ? room.topic : "" }
              </p>
            </div>
           </ul>
        </div>
    )
}