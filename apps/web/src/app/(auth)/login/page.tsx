"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});
type FormData = z.infer<typeof schema>;
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const submit = async (data: FormData) => {
    setError("");
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.05fr .95fr" },
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          bgcolor: "#101827",
          color: "white",
          p: 8,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 24 }}>
          i7AI Cloud Manager
        </Typography>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 750, maxWidth: 620 }}>
            Seus documentos e backups, organizados com segurança.
          </Typography>
          <Typography sx={{ mt: 2, color: "#A9B7CA", maxWidth: 540 }}>
            Controle multiempresa, permissões granulares e uma visão clara da
            sua infraestrutura.
          </Typography>
        </Box>
        <Typography color="#718096">© 2026 i7AI</Typography>
      </Box>
      <Box sx={{ display: "grid", placeItems: "center", p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 460 }}>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Typography variant="h4">Bem-vindo</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              Entre para acessar seu espaço de trabalho.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack
              component="form"
              spacing={2.2}
              onSubmit={handleSubmit(submit)}
            >
              <TextField
                label="E-mail"
                autoComplete="email"
                autoFocus
                {...register("email")}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
              />
              <TextField
                label="Senha"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
              />
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <FormControlLabel
                  control={<Checkbox size="small" />}
                  label="Lembrar acesso"
                />
                <Typography
                  component={Link}
                  href="/recuperar-senha"
                  color="primary"
                  variant="body2"
                >
                  Esqueci minha senha
                </Typography>
              </Stack>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
