import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "./MetricCard";
describe("MetricCard", () => {
  it("apresenta métrica e contexto", () => {
    render(createElement(MetricCard, { label: "Usuários ativos", value: 12, caption: "Na empresa", icon: createElement("span", null, "ícone") }));
    expect(screen.getByText("Usuários ativos")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
