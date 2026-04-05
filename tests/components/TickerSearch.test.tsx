import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchTicker, mockSuggestTickers } = vi.hoisted(() => ({
  mockSearchTicker: vi.fn(),
  mockSuggestTickers: vi.fn(),
}));

vi.mock("@/app/actions/search-ticker", () => ({
  searchTicker: mockSearchTicker,
  suggestTickers: mockSuggestTickers,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { TickerSearch } from "@/components/TickerSearch";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TickerSearch", () => {
  beforeEach(() => {
    mockSuggestTickers.mockResolvedValue({ success: true, suggestions: [] });
    mockSearchTicker.mockResolvedValue({
      success: true,
      data: { ticker: "AAPL", companyName: "Apple Inc." },
    });
  });

  it("renders search field and button", () => {
    render(<TickerSearch />);
    expect(
      screen.getByPlaceholderText(/ticker or company/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /search/i }),
    ).toBeInTheDocument();
  });

  it("shows inline validation when input exceeds 100 characters before submit", () => {
    render(<TickerSearch />);
    const input = screen.getByRole("combobox");
    const long = "a".repeat(101);
    fireEvent.change(input, { target: { value: long } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /use at most 100 characters in the search field/i,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(mockSearchTicker).not.toHaveBeenCalled();
  });

  it("shows validation error when submitting empty", async () => {
    const user = userEvent.setup();
    render(<TickerSearch />);

    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/enter a ticker or company name/i);
    expect(mockSearchTicker).not.toHaveBeenCalled();
  });

  it("calls searchTicker and shows result card on success", async () => {
    const user = userEvent.setup();
    render(<TickerSearch />);

    await user.type(
      screen.getByRole("combobox"),
      "AAPL",
    );
    await user.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => {
      expect(mockSearchTicker).toHaveBeenCalledWith("AAPL");
    });

    expect(
      await screen.findByText("Apple Inc."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("AAPL")).toBeInTheDocument();
  });

  it("shows error message when searchTicker fails", async () => {
    mockSearchTicker.mockResolvedValue({
      success: false,
      error: "Ticker not found or unavailable.",
    });
    const user = userEvent.setup();
    render(<TickerSearch />);

    await user.type(screen.getByRole("combobox"), "BAD");
    await user.click(screen.getByRole("button", { name: /search/i }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/ticker not found or unavailable/i);
  });

  it("debounces and calls suggestTickers after typing", async () => {
    vi.useFakeTimers();
    try {
      render(<TickerSearch />);
      const input = screen.getByRole("combobox");

      fireEvent.change(input, { target: { value: "ap" } });
      expect(mockSuggestTickers).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(mockSuggestTickers).toHaveBeenCalledWith("ap");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows Searching state on the button while resolve is pending", async () => {
    let resolveSearch!: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolveSearch = r;
    });
    mockSearchTicker.mockImplementationOnce(() => pending as never);

    const user = userEvent.setup();
    render(<TickerSearch />);

    await user.type(screen.getByRole("combobox"), "IBM");
    await user.click(
      screen.getByRole("button", { name: /submit search for ticker or company/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /searching/i }),
      ).toBeDisabled();
    });

    await act(async () => {
      resolveSearch({
        success: true,
        data: {
          ticker: "IBM",
          companyName: "International Business Machines Corporation",
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /submit search for ticker or company/i,
        }),
      ).not.toBeDisabled();
    });
  });
});
