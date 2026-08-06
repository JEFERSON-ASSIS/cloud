"use client";
import { createTheme } from "@mui/material/styles";
import { palette } from "./palette";
import { typography } from "./typography";
import { components } from "./components";
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "data" },
  colorSchemes: {
    light: { palette },
    dark: {
      palette: {
        primary: palette.primary,
        secondary: palette.secondary,
        background: { default: "#0B1220", paper: "#111827" },
      },
    },
  },
  typography,
  components,
  shape: { borderRadius: 12 },
});
