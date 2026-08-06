export const components = {
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        border: "1px solid",
        borderColor: "var(--mui-palette-divider)",
        boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: { root: { borderRadius: 10, minHeight: 40 } },
  },
  MuiTextField: { defaultProps: { size: "small" as const } },
};
