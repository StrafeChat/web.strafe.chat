/**
 * Enum representing the different types of rooms in the application
 */
export enum RoomType {
  /** Direct message between two users */
  PM = 0,
  /** Group direct message between multiple users */
  GROUP_PM = 1,
  /** Text room within a space */
  TEXT_ROOM = 2,
  /** Voice room within a space */
  VOICE_ROOM = 3,
  /** Section/category within a space */
  SPACE_SECTION = 4
}