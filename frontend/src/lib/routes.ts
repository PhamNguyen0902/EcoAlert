export const getRoleHome = (role: string | null | undefined): string => {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "/admin/reports";

    case "OFFICER":
      return "/officer/assigned";

    case "CITIZEN":
      return "/home";

    default:
      return "/login";
  }
};
