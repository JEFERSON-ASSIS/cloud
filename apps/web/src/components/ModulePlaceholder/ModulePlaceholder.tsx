import { Card, CardContent, Chip, Typography } from "@mui/material";
import { PageHeader } from "@/components/PageHeader/PageHeader";
export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <Chip label={`Fase ${phase}`} color="primary" variant="outlined" />
        }
      />
      <Card>
        <CardContent sx={{ py: 8, textAlign: "center" }}>
          <Typography variant="h6">Estrutura preparada</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Este módulo será implementado funcionalmente na Fase {phase}, após a
            validação da fase atual.
          </Typography>
        </CardContent>
      </Card>
    </>
  );
}
