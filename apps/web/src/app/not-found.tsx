"use client";

import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        p: 2,
      }}
    >
      <Box>
        <Typography variant="h2">404</Typography>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Página não encontrada
        </Typography>
        <Button component={Link} href="/dashboard" variant="contained">
          Voltar ao painel
        </Button>
      </Box>
    </Box>
  );
}
