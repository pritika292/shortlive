import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CountryChipFilter } from "../../src/client/components/CountryChipFilter.js";
import { DashboardFiltersProvider } from "../../src/client/contexts/DashboardFilters.js";
import { CURATED_COUNTRIES } from "../../src/client/lib/continents.js";

describe("<CountryChipFilter />", () => {
  it("renders a chip per curated country and toggles selection on click", () => {
    render(
      <DashboardFiltersProvider>
        <CountryChipFilter />
      </DashboardFiltersProvider>,
    );

    // One button per curated country.
    expect(screen.getAllByRole("button")).toHaveLength(CURATED_COUNTRIES.length);

    // Toggle US in and out.
    const us = screen.getByRole("button", { name: /US/ });
    fireEvent.click(us);
    // Active state styling includes the emerald gradient class.
    expect(us.className).toMatch(/emerald-500/);
    fireEvent.click(us);
    expect(us.className).not.toMatch(/emerald-500/);
  });
});
