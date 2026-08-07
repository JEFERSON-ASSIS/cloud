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
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Erro ao tentar entrar com o Google.");
      setGoogleLoading(false);
    }
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
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              Entre para acessar seu espaço de trabalho.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleGoogleLogin}
              disabled={googleLoading || isSubmitting}
              startIcon={
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              }
              sx={{
                mb: 3,
                borderColor: "#dadce0",
                color: "#3c4043",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": {
                  borderColor: "#d2e3fc",
                  bgcolor: "rgba(66, 133, 244, 0.04)",
                },
              }}
            >
              {googleLoading ? "Conectando ao Google..." : "Entrar com Google"}
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary">
                ou continue com e-mail
              </Typography>
            </Divider>

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
                disabled={isSubmitting || googleLoading}
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
