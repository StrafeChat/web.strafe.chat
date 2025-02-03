import { UserStatus } from "../../components/common/StatusIndicator";

export const capitalizeStatus = (status: string): UserStatus => {
  const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
  return capitalized as UserStatus;
};
