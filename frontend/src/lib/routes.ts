export const getRoleHome = (role: string | null | undefined): string => {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard";

    case "OFFICER":
      return "/officer/dashboard";

    case "CITIZEN":
      return "/home";

    default:
      return "/login";
  }
};