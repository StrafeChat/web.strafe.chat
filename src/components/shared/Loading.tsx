"use client"
export function LoadingScreen() {

  return (
    <div className="flex flex-col w-full h-full">
      <div className="bg-[#262626] flex items-center justify-center flex-col h-[100vh] py-3 px-5 text-center">
      <div className="loading loading02">
        <span>S</span>
        <span>T</span>
        <span>R</span>
        <span>A</span>
        <span>F</span>
        <span>E</span>
        <span>.</span>
      </div>
      </div>
    </div>
  );
}