import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuleForm } from "../../src/client/components/RuleForm.js";

describe("<RuleForm />", () => {
  it("renders the four rule types and switches form fields when the type changes", () => {
    render(<RuleForm short="t1" onCreated={vi.fn()} />);
    const select = screen.getByLabelText(/^Type$/i) as HTMLSelectElement;
    expect(select.options.length).toBe(4);

    // threshold default — count field visible
    expect(screen.getByLabelText(/Count \(N\)/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "velocity" } });
    expect(screen.getByLabelText(/Window \(seconds\)/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "first_of" } });
    expect(screen.getByLabelText(/^Dimension$/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "per_click" } });
    expect(screen.getByLabelText(/Countries/i)).toBeInTheDocument();
  });

  it("posts the right shape on submit", async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ rule: {} }), { status: 200 }));

    render(<RuleForm short="t1" onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/Destination URL/i), {
      target: { value: "https://w.example/" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create rule/i }));

    // Let the microtask queue drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/links/t1/rules");
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.type).toBe("threshold");
    expect(body.destination_url).toBe("https://w.example/");
    expect(body.config.count).toBe(5);

    fetchMock.mockRestore();
  });
});
