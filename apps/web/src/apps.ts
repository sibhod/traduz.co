export interface AppLink {
  title: string;
  path: string; // absolute directory path with trailing slash, e.g. '/mata-el-torre/'
  blurb: string;
}

export const APPS: AppLink[] = [
  {
    title: 'Mata el Torre',
    path: '/mata-el-torre/',
    blurb: 'Vocabulary roguelike — your words as cards, recall as the casting cost.',
  },
];
