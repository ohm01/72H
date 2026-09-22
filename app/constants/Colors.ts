const tintColorLight = '#2b6a4f';
const tintColorDark = '#7cc4a0';

// Expiry colors are shared by both themes.
export const ExpiryColors = {
  expired: '#c62828',
  red: '#e53935',
  orange: '#f09000',
  green: '#2e9d57',
  none: '#9e9e9e',
};

export default {
  light: {
    text: '#1b1f1d',
    muted: '#5f6b66',
    background: '#f6f7f5',
    card: '#ffffff',
    border: '#dfe3e0',
    tint: tintColorLight,
    onTint: '#ffffff',
    danger: '#c62828',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#eef1ef',
    muted: '#a3ada8',
    background: '#0f1211',
    card: '#1a1f1d',
    border: '#2c3330',
    tint: tintColorDark,
    onTint: '#0f1211',
    danger: '#ef6b6b',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
