export const profiles = {
  alex: {
    name: "Alex Morgan",
    handle: "@alex.exe",
    initials: "AM",
    color: "lime",
    description:
      "Race weekends. Late-night rabbit holes. A very specific taste in everything.",
    interests: ["Formula 1", "Technology", "Music", "Gaming"],
  },
  jamie: {
    name: "Jamie Park",
    handle: "@jamie.jpg",
    initials: "JP",
    color: "lavender",
    description: "Good design, better playlists, and always one more lap.",
    interests: ["Formula 1", "Music", "Fashion", "Food"],
  },
} as const;
export const reels = [
  {
    id: "f1",
    category: "Formula 1",
    title: "ONE MORE LAP.",
    subtitle: "A race weekend state of mind",
    className: "racing",
    number: "01",
    duration: "0:24",
  },
  {
    id: "music",
    category: "Music",
    title: "ON REPEAT",
    subtitle: "The tracks that find you",
    className: "music",
    number: "02",
    duration: "0:32",
  },
  {
    id: "tech",
    category: "Technology",
    title: "WHAT’S NEXT?",
    subtitle: "Down the rabbit hole",
    className: "tech",
    number: "03",
    duration: "0:18",
  },
  {
    id: "fashion",
    category: "Fashion",
    title: "OFF DUTY.",
    subtitle: "A little less ordinary",
    className: "fashion",
    number: "04",
    duration: "0:21",
  },
] as const;
export const categories = [
  { name: "Formula 1", alex: 94, jamie: 88 },
  { name: "Technology", alex: 86, jamie: 42 },
  { name: "Music", alex: 78, jamie: 92 },
  { name: "Gaming", alex: 66, jamie: 30 },
  { name: "Fashion", alex: 35, jamie: 82 },
  { name: "Food", alex: 52, jamie: 74 },
];
export const starters = [
  "Which race would you drop everything to see live?",
  "What’s the one track you refuse to skip?",
  "What’s a rabbit hole your feed sent you down recently?",
];

export const compatibility = {
  score: 84,
  shared: ["Formula 1", "Music", "Food"],
  summary:
    "A shared love of fast cars and slow Sundays. Enough in common to click. Enough difference to keep it interesting.",
};
