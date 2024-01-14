import { useModal } from "@/controllers/modals/ModalController";
import Link from "next/link"
import { useClient } from "@/controllers/client/ClientController";
import { FaCompass, FaGear, FaPlus } from "react-icons/fa6";

export default function SpaceList() {

   const { openModal } = useModal();
   const { client } = useClient(); 

   return (
      <div className="space-list">
         <Link href="/">
            <button>
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={`http://localhost:446/avatars/6362990690116305920/b25caa834adff09b82c2f8ea421f401c065fdb493fdb0305cf859d4d62efa950.webp`} alt=""></img>
            </button>
         </Link>
         <div className="seperator" />

         <div className="spaces">
            <Link href="/spaces/strafe">
               <button className="space">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="space" src="https://cdn.discordapp.com/icons/1125943618876735500/03625cebd9f4304c834c07625f2a4f1e.webp?size=4096" alt=""></img>
               </button>
            </Link>
            <Link href="/spaces/trumpfanclub">
               <button className="space">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="space" src="https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmedia.kjzz.org%2Fs3fs-public%2Fdonald-trump-170818.jpg&f=1&nofb=1&ipt=0fa3dab62d6f1302ce1b234302429284a4e5b0128a3bcc8913daf08bfbd7465f&ipo=images" alt=""></img>
               </button>
            </Link>
         </div>

         <div className="seperator" />

         <button className="primary disabled">
            <FaPlus />
         </button>
         <button className="primary disabled">
            <FaCompass />
         </button>
         <button className="primary" onClick={() => openModal("settings")}>
            <FaGear />
         </button>
      </div>
   )
}