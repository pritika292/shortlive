import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breakdown } from "../../src/client/components/Breakdown.js";

describe("<Breakdown />", () => {
  it("renders the empty state when there are no rows", () => {
    render(<Breakdown rows={[]} label="Country" />);
    expect(screen.getByText(/no country data yet/i)).toBeInTheDocument();
  });

  it("renders rows with count and percent", () => {
    render(
      <Breakdown
        rows={[
          { value: "US", count: 30, percent: 60 },
          { value: "DE", count: 20, percent: 40 },
        ]}
        label="Country"
      />,
    );
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});
