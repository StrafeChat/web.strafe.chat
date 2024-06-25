import { ParticipantTileProps } from "@/types";

export function ParticipantTile({ user, video }: ParticipantTileProps) {
  return (
    <div>
      <div className="video">
        { (video !== null) ? (
          // TODO: display video track
        ) : (
          // TODO: display avatar
        )}    
      </div>
    </div>
  )
}
