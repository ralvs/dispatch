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
	/** The authed layout's `children` segment. Null reads it off `pathname`. */
	page: null as string | null,
};

export const nextNavigationMock = {
	useRouter: () => router,
	usePathname: () => navigation.pathname,
	useSearchParams: () => navigation.searchParams,
	useSelectedLayoutSegment: () => navigation.page ?? (navigation.pathname.split("/")[1] || null),
	useParams: () => ({}),
	redirect: vi.fn(),
	notFound: vi.fn(),
};
