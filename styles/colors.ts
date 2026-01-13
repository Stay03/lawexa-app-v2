const Base = {
  Gold: {
    Light: '#D4A853',
    Default: '#C9A227',
    Dark: '#A68523',
  },
  Brown: {
    Lightest: '#3D3A35',
    Lighter: '#2D2A25',
    Light: '#252219',
    Default: '#1C1A15',
    Dark: '#141210',
  },
  Gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  White: '#ffffff',
  Black: '#000000',
};

export const Colors = {
  // Dark theme
  dark: {
    background: {
      primary: Base.Brown.Default,
      secondary: Base.Brown.Light,
      tertiary: Base.Brown.Lighter,
    },
    foreground: {
      primary: Base.White,
      secondary: Base.Gray[400],
      muted: Base.Gray[500],
    },
    accent: {
      primary: Base.Gold.Default,
      hover: Base.Gold.Light,
    },
    border: Base.Brown.Lightest,
  },
  // Light theme
  light: {
    background: {
      primary: Base.White,
      secondary: Base.Gray[50],
      tertiary: Base.Gray[100],
    },
    foreground: {
      primary: Base.Gray[900],
      secondary: Base.Gray[600],
      muted: Base.Gray[500],
    },
    accent: {
      primary: Base.Gold.Default,
      hover: Base.Gold.Dark,
    },
    border: Base.Gray[200],
  },
};
