import { FaCog, FaCompass, FaPlus } from "react-icons/fa";

export default function SpaceList() {
   return (
      <div className="space-list">
         <button />
         <div className="seperator" />

         <div className="spaces"/>

         <div className="seperator" />

         <button className="primary disabled">
            <FaPlus />
         </button>
         <button className="primary disabled">
            <FaCompass />
         </button>
         <button className="primary">
            <FaCog />
         </button>
      </div>
   )
}