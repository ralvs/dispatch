import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentView } from "./consent-view";

const auth = {
	getSession: vi.fn(),
	signInWithPassword: vi.fn(),
	oauth: {
		getAuthorizationDetails: vi.fn(),
		approveAuthorization: vi.fn(),
		denyAuthorization: vi.fn(),
	},
};
vi.mock("@/lib/supabase/browser", () => ({ browserAuth: () => auth }));

const replace = vi.fn();
const SESSION = { data: { session: { access_token: "t" } } };

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, "", "/oauth/consent?authorization_id=auth-1");
	vi.stubGlobal("location", { ...window.location, replace, search: "?authorization_id=auth-1" });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ConsentView", () => {
	it("shows the sign-in form to a signed-out visitor", async () => {
		auth.getSession.mockResolvedValue({ data: { session: null } });
		render(<ConsentView />);
		expect(await screen.findByLabelText("Email")).toBeTruthy();
		expect(screen.getByLabelText("Password")).toBeTruthy();
		expect(auth.oauth.getAuthorizationDetails).not.toHaveBeenCalled();
	});

	it("hands an already-granted request straight back to the client", async () => {
		auth.getSession.mockResolvedValue(SESSION);
		auth.oauth.getAuthorizationDetails.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?code=x" },
			error: null,
		});
		render(<ConsentView />);
		await waitFor(() => expect(replace).toHaveBeenCalledWith("https://claude.ai/cb?code=x"));
	});

	it("names the client and lists each scope, and Deny denies", async () => {
		auth.getSession.mockResolvedValue(SESSION);
		auth.oauth.getAuthorizationDetails.mockResolvedValue({
			data: {
				authorization_id: "auth-1",
				client: { id: "client-1", name: "" },
				scope: "openid  email",
			},
			error: null,
		});
		auth.oauth.denyAuthorization.mockResolvedValue({
			data: { redirect_url: "https://claude.ai/cb?error=access_denied" },
			error: null,
		});
		render(<ConsentView />);
		expect(await screen.findByText("client-1")).toBeTruthy();
		const scopes = screen.getByRole("list", { name: "Requested scopes" });
		expect(scopes.querySelectorAll("li")).toHaveLength(2);

		await userEvent.click(screen.getByRole("button", { name: "Deny" }));
		expect(auth.oauth.denyAuthorization).toHaveBeenCalledWith("auth-1");
		expect(auth.oauth.approveAuthorization).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(replace).toHaveBeenCalledWith("https://claude.ai/cb?error=access_denied"),
		);
	});
});
