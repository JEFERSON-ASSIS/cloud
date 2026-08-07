"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  IconButton,
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
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

type FormData = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [formError, setFormError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const getErrorMessage = () => {
    if (formError) return formError;
    if (!urlError) return "";
    switch (urlError) {
      case "AccessDenied":
        return "Você não possui cadastro no sistema. Entre em contato com o administrador da sua prefeitura.";
      case "Configuration":
        return "Configuração ou credenciais OAuth pendentes. Entre em contato com o administrador da sua prefeitura.";
      case "OAuthSignin":
      case "OAuthCallback":
        return "Erro ao conectar com o Google. Tente novamente.";
      case "CredentialsSignin":
        return "E-mail ou senha incorretos.";
      default:
        return "Você não possui cadastro no sistema. Entre em contato com o administrador da sua prefeitura.";
    }
  };

  const submit = async (data: FormData) => {
    setFormError("");
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setFormError("E-mail ou senha inválidos.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setFormError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setFormError("Erro ao iniciar sessão com o Google.");
      setGoogleLoading(false);
    }
  };

  const activeError = getErrorMessage();

  return (
    <Box
      sx={{
        height: "100vh",
        maxHeight: "100vh",
        bgcolor: "#0f0b29", // Fundo oficial i7AI
        backgroundImage:
          "radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.18) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(79, 70, 229, 0.15) 0%, transparent 50%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, md: 4, lg: 6 },
        py: { xs: 1, sm: 2 },
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Container maxWidth="xl" disableGutters sx={{ px: { xs: 1, sm: 2, lg: 4 } }}>
        <Grid container spacing={{ xs: 3, lg: 5 }} sx={{ alignItems: "center" }}>
          {/* LADO ESQUERDO: Apresentação Institucional Cloud Manager */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack
              spacing={{ xs: 1.5, sm: 2, lg: 2.5 }}
              sx={{
                maxWidth: 680,
                mx: "auto",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {/* Logo Emblem i7AI Proporcional ao Viewport */}
              <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <Box
                  component="img"
                  src="/i7ai-logo.png"
                  alt="I7AI Sistemas Inteligentes"
                  sx={{
                    height: { xs: 70, sm: 95, lg: 110 },
                    width: "auto",
                    display: "block",
                    filter: "drop-shadow(0 0 25px rgba(99, 102, 241, 0.45))",
                  }}
                />
              </Box>

              {/* Badge B2G */}
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Chip
                  icon={<AccountBalance sx={{ fontSize: 14, color: "#818cf8 !important" }} />}
                  label="SOLUÇÃO B2G • PARA PREFEITURAS E REDES PÚBLICAS"
                  sx={{
                    bgcolor: "rgba(99, 102, 241, 0.18)",
                    color: "#818cf8",
                    borderColor: "rgba(99, 102, 241, 0.35)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    fontWeight: 800,
                    fontSize: { xs: 9.5, sm: 10.5 },
                    letterSpacing: 0.8,
                    px: 1.2,
                    height: 26,
                    borderRadius: 2,
                  }}
                />
              </Box>

              {/* Título Principal Cloud Manager */}
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 22, sm: 32, lg: 40 },
                  lineHeight: 1.15,
                  color: "#ffffff",
                  letterSpacing: "-0.03em",
                }}
              >
                Seus documentos e backups, organizados com segurança.
              </Typography>

              {/* Subtítulo Cloud Manager */}
              <Typography
                sx={{
                  fontSize: { xs: 13, sm: 15, lg: 16 },
                  color: "#cbd5e1",
                  lineHeight: 1.5,
                  maxWidth: 600,
                }}
              >
                Organize backups municipais, conecte secretarias e preserve a
                trajetória e a segurança de dados de cada departamento em uma única plataforma.
              </Typography>

              {/* 3 Cards Cloud Manager no Rodapé */}
              <Grid container spacing={1.5} sx={{ pt: 0.5, width: "100%" }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: { xs: 1.5, lg: 2 },
                      borderRadius: 2.5,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                      textAlign: "left",
                    }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1.5,
                        bgcolor: "rgba(99, 102, 241, 0.25)",
                        color: "#818cf8",
                        display: "grid",
                        placeItems: "center",
                        mb: 0.75,
                      }}
                    >
                      <ShieldOutlined sx={{ fontSize: 17 }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.25, fontSize: 12.5 }}>
                      Gestão Pública Integrada
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.3, display: "block", fontSize: 10.5 }}>
                      Registros, secretarias e backups organizados no mesmo fluxo.
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: { xs: 1.5, lg: 2 },
                      borderRadius: 2.5,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                      textAlign: "left",
                    }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1.5,
                        bgcolor: "rgba(16, 185, 129, 0.2)",
                        color: "#10b981",
                        display: "grid",
                        placeItems: "center",
                        mb: 0.75,
                      }}
                    >
                      <VerifiedUserOutlined sx={{ fontSize: 17 }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.25, fontSize: 12.5 }}>
                      Segurança & Controle
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.3, display: "block", fontSize: 10.5 }}>
                      Perfis e permissões para proteger informações institucionais.
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box
                    sx={{
                      p: { xs: 1.5, lg: 2 },
                      borderRadius: 2.5,
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      height: "100%",
                      textAlign: "left",
                    }}
                  >
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1.5,
                        bgcolor: "rgba(99, 102, 241, 0.25)",
                        color: "#818cf8",
                        display: "grid",
                        placeItems: "center",
                        mb: 0.75,
                      }}
                    >
                      <BackupOutlined sx={{ fontSize: 17 }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "white", mb: 0.25, fontSize: 12.5 }}>
                      Continuidade & Recovery
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8", lineHeight: 1.3, display: "block", fontSize: 10.5 }}>
                      Histórico preservado para decisões mais seguras ao longo da jornada.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          {/* LADO DIREITO: Card Institucional Branco */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ maxWidth: 420, mx: "auto" }}>
              <Card
                sx={{
                  bgcolor: "#ffffff",
                  color: "#1e293b",
                  borderRadius: 3.5,
                  boxShadow: "0 20px 45px rgba(0, 0, 0, 0.4)",
                  p: { xs: 2.5, sm: 3 },
                }}
              >
                <CardContent sx={{ p: 0 }}>
                  <Stack spacing={2}>
                    {/* Header do Card */}
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#4f46e5",
                          fontWeight: 800,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          fontSize: 10,
                        }}
                      >
                        ÁREA INSTITUCIONAL
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 800, color: "#0f0b29", mt: 0.25, fontSize: { xs: 20, sm: 22 } }}
                      >
                        Acesso ao sistema
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#64748b", mt: 0.25, fontSize: 12.5 }}>
                        Utilize suas credenciais institucionais para acessar o painel de gestão.
                      </Typography>
                    </Box>

                    {activeError && (
                      <Alert severity="error" sx={{ borderRadius: 2, py: 0.5, px: 1.5, fontSize: 12 }}>
                        {activeError}
                      </Alert>
                    )}

                    {/* Formulário */}
                    <Stack
                      component="form"
                      spacing={1.75}
                      onSubmit={handleSubmit(submit)}
                    >
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: "#334155",
                            mb: 0.5,
                            display: "block",
                            textTransform: "uppercase",
                            fontSize: 10,
                          }}
                        >
                          E-MAIL PROFISSIONAL
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="nome@prefeitura.gov.br"
                          {...register("email")}
                          error={Boolean(errors.email)}
                          helperText={errors.email?.message}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EmailOutlined sx={{ color: "#94a3b8", fontSize: 18 }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#f8faff",
                              borderRadius: 2,
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
                            mb: 0.5,
                            display: "block",
                            textTransform: "uppercase",
                            fontSize: 10,
                          }}
                        >
                          SUA SENHA
                        </Typography>
                        <TextField
                          fullWidth
                          type={showPassword ? "text" : "password"}
                          size="small"
                          placeholder="••••••••"
                          {...register("password")}
                          error={Boolean(errors.password)}
                          helperText={errors.password?.message}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <LockOutlined sx={{ color: "#94a3b8", fontSize: 18 }} />
                                </InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label="alternar visibilidade da senha"
                                    onClick={() => setShowPassword((show) => !show)}
                                    edge="end"
                                    size="small"
                                    sx={{ color: "#94a3b8" }}
                                  >
                                    {showPassword ? (
                                      <VisibilityOff sx={{ fontSize: 18 }} />
                                    ) : (
                                      <Visibility sx={{ fontSize: 18 }} />
                                    )}
                                  </IconButton>
                                </InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: "#f8faff",
                              borderRadius: 2,
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
                        size="medium"
                        disabled={isSubmitting || googleLoading}
                        endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
                        sx={{
                          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                          color: "white",
                          py: 1.1,
                          borderRadius: 2,
                          fontWeight: 800,
                          fontSize: 14,
                          textTransform: "none",
                          boxShadow: "0 8px 18px rgba(99, 102, 241, 0.28)",
                          "&:hover": {
                            background: "linear-gradient(135deg, #4f46e5, #3730a3)",
                            boxShadow: "0 12px 22px rgba(99, 102, 241, 0.38)",
                          },
                        }}
                      >
                        {isSubmitting ? "Entrando..." : "Entrar no Sistema"}
                      </Button>
                    </Stack>

                    <Divider sx={{ borderColor: "#e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 700, fontSize: 9 }}>
                        OU CONTINUE COM
                      </Typography>
                    </Divider>

                    {/* Botão Google */}
                    <Button
                      fullWidth
                      variant="outlined"
                      size="medium"
                      onClick={handleGoogleLogin}
                      disabled={googleLoading || isSubmitting}
                      startIcon={
                        <svg width="18" height="18" viewBox="0 0 24 24">
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
                        py: 0.9,
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        "&:hover": {
                          borderColor: "#94a3b8",
                          bgcolor: "#f8faff",
                        },
                      }}
                    >
                      {googleLoading ? "Conectando ao Google..." : "Continuar com Google"}
                    </Button>

                    <Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center" }}>
                      <ShieldOutlined sx={{ fontSize: 14, color: "#10b981" }} />
                      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500, fontSize: 10.5 }}>
                        Ambiente seguro e acesso restrito a usuários autorizados.
                      </Typography>
                    </Stack>

                    <Divider sx={{ borderColor: "#f1f5f9" }} />

                    {/* Footer CNPJ e Empresa */}
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" sx={{ color: "#475569", fontWeight: 800, display: "block", fontSize: 10.5 }}>
                        I7AI SISTEMAS INTELIGENTES LTDA
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", fontSize: 9, mt: 0.25 }}>
                        CNPJ: 52.177.930/0001-01 | Telefone: (66) 99655-3735
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", fontSize: 9, mt: 0.25 }}>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
