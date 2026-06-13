export type DemoUser = {
  name: string;
  email: string;
  initials: string;
};

export type DemoCredits = {
  images: number;
  songs: number;
};

export const demoUser: DemoUser = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };
export const demoCredits: DemoCredits = { images: 7, songs: 3 };
export const demoCardBank = 3;
