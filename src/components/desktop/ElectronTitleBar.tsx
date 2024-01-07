
export default function ElectronTitleBar() {
  return (
     <div className="titlebar p-1 h-6">
        <p className="text-gray-500 pl-[10px] text-[14px] font-cario opacity-1 font-bold"><b>STRAFE</b></p>
        {/* <button onClick={() => {}} className="absolute right-[85px]  text-gray-500 pr-3 top-[-4px] w-[20px] hover:bg-gray-500">
            <FontAwesomeIcon icon={faWindowMinimize} />
        </button>
         <button onClick={() => {(window as any).resizeTo(screen.availWidth, screen.availHeight)}} className="absolute right-[45px] text-gray-500 pr-3 top-[2px] w-[20px] h-[20px] hover:bg-gray-500">
            <FontAwesomeIcon icon={faWindowMaximize} />
        </button>   
        <button onClick={() => {(window as any).close()}} className="absolute text-gray-500 pl-[3px] right-[10px] hover:text-red-700 top-[2px] w-[20px] h-[20px]">
            <FontAwesomeIcon icon={faWindowClose} />
        </button>      */}
    </div>
  );
}