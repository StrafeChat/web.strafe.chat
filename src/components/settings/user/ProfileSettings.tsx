import { useClient } from "@/hooks";

export function ProfileSettings() {
    const { client } = useClient();
    
    return (
        <>
        <h1 className="title">Profile</h1>

        <div>
             <input
                  type="file"
                  accept="image/png, image/gif, image/jpeg"
                  className="avatar group-hover:opacity-80 z-[1001]"
                  onChange={(event) => {
                    if (event.target.files) {
                      if (event.target.files.length > 0) {
                        let reader = new FileReader();
                        reader.readAsDataURL(event.target.files[0]);
                        reader.onload = (loaded) => {
                           client?.user?.edit({
                              avatar: loaded.target?.result?.toString()!
                           })
                        };
                      }
                    }
                  }}
                />
            </div>
    </>
    )
}