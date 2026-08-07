"use client";

import { useState } from "react";
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
  Chip,
  Container,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  EmailOutlined,
  LockOutlined,
  ArrowForward,
  ShieldOutlined,
  VerifiedUserOutlined,
  BackupOutlined,
  AccountBalance,
} from "@mui/icons-material";

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
        bgcolor: "#0f0b29", // Indigo-950 institucional i7AI
        backgroundImage:
          "radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.18) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(79, 70, 229, 0.15) 0%, transparent 50%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        py: { xs: 4, md: 8 },
        px: { xs: 2, md: 6 },
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={6} sx={{ alignItems: "center" }}>
          {/* LADO ESQUERDO: Apresentação Institucional i7AI */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={4} sx={{ maxWidth: 720, mx: { xs: "auto", lg: 0 } }}>
              {/* Logo Oficial i7AI (Tamanho Exato do Portal) */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  component="img"
                  src="/i7ai-logo.png"
                  alt="I7AI Sistemas Inteligentes"
                  sx={{
                    width: 230,
                    height: "auto",
                    display: "block",
                    transform: "scale(1.25)",
                    transformOrigin: "left center",
                    filter: "drop-shadow(0 0 20px rgba(99, 102, 241, 0.4))",
                  }}
                />
              </Box>

              {/* Badge B2G */}
              <Box>
                <Chip
                  icon={<AccountBalance sx={{ fontSize: 16, color: "#818cf8 !important" }} />}
                  label="SOLUÇÃO B2G • PARA PREFEITURAS E REDES PÚBLICAS"
                  sx={{
                    bgcolor: "rgba(99, 102, 241, 0.18)",
                    color: "#818cf8",
                    borderColor: "rgba(99, 102, 241, 0.35)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    fontWeight: 800,
                    fontSize: 11,
                    letterSpacing: 1,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                  }}
                />
              </Box>

              {/* Título Principal */}
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 32, sm: 44, md: 54 },
                  lineHeight: 1.12,
                  color: "#ffffff",
                  letterSpacing: "-0.03em",
                }}
              >
                Tecnologia para uma gestão pública inclusiva, integrada e segura.
              </Typography>

              {/* Subtítulo */}
              <Typography
                sx={{
                  fontSize: { xs: 16, sm: 18 },
                  color: "#cbd5e1",
                  lineHeight: 1.65,
                  maxWidth: 640,
                }}
              >
                Organize backups municipais, conecte secretarias e preserve a
                trajetória e a segurança de dados de cada departamento em uma única plataforma.
              </Typography>

              {/* 3 Cards de Funcionalidades no Rodapé */}
              <Grid container spacing={2} sx={{ pt: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        bgcolor: "rgba(99, 102, 241, 0.25)",
                        color: "#818cf8",
                        display: "grid",
                        placeItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <ShieldOutlined fontSize="small" />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>
                      Gestão Pública Integrada
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.4, display: "block" }}>
                      Registros, secretarias e backups organizados no mesmo fluxo.
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        bgcolor: "rgba(16, 185, 129, 0.2)",
                        color: "#10b981",
                        display: "grid",
                        placeItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <VerifiedUserOutlined fontSize="small" />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>
                      Segurança & Controle
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.4, display: "block" }}>
                      Perfis e permissões para proteger informações institucionais.
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        bgcolor: "rgba(99, 102, 241, 0.25)",
                        color: "#818cf8",
                        display: "grid",
                        placeItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <BackupOutlined fontSize="small" />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.5 }}>
                      Continuidade & Recovery
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.4, display: "block" }}>
                      Histórico preservado para decisões mais seguras ao longo da jornada.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          {/* LADO DIREITO: Form de Login Flutuante Estilo Institucional */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ maxWidth: 450, mx: "auto" }}>
              <Card
                sx={{
                  bgcolor: "#ffffff",
                  color: "#1e293b",
                  borderRadius: 4,
                  boxShadow: "0 26px 70px rgba(15, 23, 42, 0.35)",
                  p: { xs: 3, sm: 4 },
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Stack spacing={3}>
                    {/* Header do Card */}
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#4f46e5",
                          fontWeight: 800,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                        }}
                      >
                        ÁREA INSTITUCIONAL
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: 800, color: "#0f0b29", mt: 0.5 }}
                      >
                        Acesso ao sistema
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
                        Utilize suas credenciais institucionais para acessar o painel de gestão.
                      </Typography>
                    </Box>

                    {error && (
                      <Alert severity="error" sx={{ borderRadius: 2 }}>
                        {error}
                      </Alert>
                    )}

                    {/* Formulário */}
                    <Stack
                      component="form"
                      spacing={2.5}
                      onSubmit={handleSubmit(submit)}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: "#334155",
                            mb: 0.75,
                            display: "block",
                            textTransform: "uppercase",
                            fontSize: 11,
                          }}
                        >
                          E-MAIL PROFISSIONAL
                        </Typography>
                        <TextField
                          fullWidth
                          size="medium"
                          placeholder="nome@prefeitura.gov.br"
                          {...register("email")}
                          error={Boolean(errors.email)}
                          helperText={errors.email?.message}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailOutlined sx={{ color: "#94a3b8" }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#f8faff",
                              borderRadius: 2.5,
                              "& fieldset": { borderColor: "#cbd5e1" },
                              "&:hover fieldset": { borderColor: "#94a3b8" },
                              "&.Mui-focused fieldset": { borderColor: "#4f46e5" },
                            },
                          }}
                        />
                      </Box>

                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: "#334155",
                            mb: 0.75,
                            display: "block",
                            textTransform: "uppercase",
                            fontSize: 11,
                          }}
                        >
                          SUA SENHA
                        </Typography>
                        <TextField
                          fullWidth
                          type="password"
                          size="medium"
                          placeholder="••••••••"
                          {...register("password")}
                          error={Boolean(errors.password)}
                          helperText={errors.password?.message}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <LockOutlined sx={{ color: "#94a3b8" }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#f8faff",
                              borderRadius: 2.5,
                              "& fieldset": { borderColor: "#cbd5e1" },
                              "&:hover fieldset": { borderColor: "#94a3b8" },
                              "&.Mui-focused fieldset": { borderColor: "#4f46e5" },
                            },
                          }}
                        />
                      </Box>

                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={isSubmitting || googleLoading}
                        endIcon={<ArrowForward />}
                        sx={{
                          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                          color: "white",
                          py: 1.5,
                          borderRadius: 2.5,
                          fontWeight: 800,
                          fontSize: 15,
                          textTransform: "none",
                          boxShadow: "0 14px 26px rgba(99, 102, 241, 0.28)",
                          "&:hover": {
                            background: "linear-gradient(135deg, #4f46e5, #3730a3)",
                            boxShadow: "0 16px 30px rgba(99, 102, 241, 0.38)",
                          },
                        }}
                      >
                        {isSubmitting ? "Entrando..." : "Entrar no Sistema"}
                      </Button>
                    </Stack>

                    <Divider sx={{ borderColor: "#e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 700, fontSize: 10 }}>
                        OU CONTINUE COM
                      </Typography>
                    </Divider>

                    {/* Botão Google */}
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
                        borderColor: "#cbd5e1",
                        color: "#334155",
                        py: 1.2,
                        borderRadius: 2.5,
                        textTransform: "none",
                        fontWeight: 600,
                        "&:hover": {
                          borderColor: "#94a3b8",
                          bgcolor: "#f8faff",
                        },
                      }}
                    >
                      {googleLoading ? "Conectando ao Google..." : "Continuar com Google"}
                    </Button>

                    <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center", pt: 1 }}>
                      <ShieldOutlined sx={{ fontSize: 16, color: "#10b981" }} />
                      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>
                        Ambiente seguro e acesso restrito a usuários autorizados.
                      </Typography>
                    </Stack>

                    <Divider sx={{ borderColor: "#f1f5f9" }} />

                    {/* Footer CNPJ e Empresa */}
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" sx={{ color: "#475569", fontWeight: 800, display: "block" }}>
                        I7AI SISTEMAS INTELIGENTES LTDA
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", fontSize: 10, mt: 0.25 }}>
                        CNPJ: 52.177.930/0001-01 | Telefone: (66) 99655-3735
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", fontSize: 10, mt: 0.25 }}>
                        © 2026 i7AI Sistemas Inteligentes. Tecnologia para fortalecer a gestão pública.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
