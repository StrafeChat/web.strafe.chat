/**
 * Enum representing the different types of rooms in the application
 */
export enum RoomType {
  /** Direct message between two users */
  PM = 0,
  /** Group direct message between multiple users */
  GROUP_PM = 1,
  /** Channel within a server */
  SERVER_CHANNEL = 2
}