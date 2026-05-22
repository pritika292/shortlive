import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveCounter } from "../../src/client/components/LiveCounter.js";

describe("<LiveCounter />", () => {
  it("renders the count with thousands separators", () => {
    render(<LiveCounter count={1234} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders 0 when count is zero", () => {
    render(<LiveCounter count={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
