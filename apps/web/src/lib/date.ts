export const CUIABA_TIME_ZONE = "America/Cuiaba";

export function formatCuiabaDateTime(value: Date | string | number) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CUIABA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatCuiabaDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CUIABA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCuiabaDayMonth(value: Date | string | number) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CUIABA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
