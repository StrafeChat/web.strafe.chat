import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks";

export function RoleSettings() {
  const { openModal } = useModal();

  return (
    <div>
      <h1 className="title">Roles</h1>
      <p>
        Roles are used to group members in your space and grant them
        permissions.
      </p>
      <div className="flex flex-col w-[75%] mt-5 justify-center">
        <div className="flex gap-x-2">
          <div className="flex flex-grow items-center select-none">
            <input
              type="text"
              className="select-none w-full p-2 px-2 rounded-lg font-medium bg-input"
              placeholder="Search Roles"
            />
            <Button
              onClick={() => openModal("create-role")}
              type="submit"
              className="bg-primary mx-3 font-bold rounded-lg hover:opacity-55 text-white h-full"
            >
              Create Role
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}