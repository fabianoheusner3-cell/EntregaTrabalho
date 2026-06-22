export const colors = {
  background: '#F4F7FB',
  card: '#FFFFFF',
  primary: '#438FD8',
  primaryDark: '#2475BE',
  text: '#172033',
  muted: '#7C8799',
  border: '#D9E1EC',
  danger: '#C53D4D',
};

export const navigationTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '800',
    },
  },
};
