import { vi } from "vitest";

/** The spy router every `useRouter()` returns in the component layer. */
export const router = {
	push: vi.fn(),
	replace: vi.fn(),
	refresh: vi.fn(),
	back: vi.fn(),
	forward: vi.fn(),
	prefetch: vi.fn(),
};

export const navigation = {
	pathname: "/today",
	searchParams: new URLSearchParams(),
};

export const nextNavigationMock = {
	useRouter: () => router,
	usePathname: () => navigation.pathname,
	useSearchParams: () => navigation.searchParams,
	useParams: () => ({}),
	redirect: vi.fn(),
	notFound: vi.fn(),
};
