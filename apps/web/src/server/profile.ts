import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(120),
    currentPassword: z.string().max(200).optional().default(""),
    newPassword: z.string().max(200).optional().default(""),
    confirmPassword: z.string().max(200).optional().default(""),
  })
  .superRefine((data, context) => {
    const wantsPasswordChange = Boolean(
      data.currentPassword || data.newPassword || data.confirmPassword,
    );
    if (!wantsPasswordChange) return;
    if (!data.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Informe a senha atual.",
      });
    }
    if (data.newPassword.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "A nova senha deve ter pelo menos 8 caracteres.",
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "A confirmação da senha não confere.",
      });
    }
  });
