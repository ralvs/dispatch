import { describe, expect, it } from "vitest";
import { parseFxTwitter, parseMetadata, tidyXHead, xStatusEndpoint } from "@/lib/links/metadata";

// parseMetadata is the pure half of the fetcher — fetchLinkMetadata itself is
// the network edge and is left to manual verification, like lib/caldav/client.

describe("parseMetadata", () => {
	it("prefers og:title over <title>", () => {
		const html = `<head><title>Site name</title><meta property="og:title" content="The real headline"></head>`;
		expect(parseMetadata(html).title).toBe("The real headline");
	});

	it("falls back to <title> when no meta tags exist", () => {
		expect(parseMetadata("<head><title>Just a title</title></head>").title).toBe("Just a title");
	});

	it("reads content before property, whichever order the attributes come in", () => {
		const html = `<head><meta content="Backwards" property="og:title"></head>`;
		expect(parseMetadata(html).title).toBe("Backwards");
	});

	it("matches description by name as well as property", () => {
		const html = `<head><meta name="description" content="A summary."></head>`;
		expect(parseMetadata(html).description).toBe("A summary.");
	});

	it("decodes entities, leaving a bare ampersand intact", () => {
		const html = `<head><title>Tom &amp; Jerry &lt;3 &#233;</title></head>`;
		expect(parseMetadata(html).title).toBe("Tom & Jerry <3 é");
	});

	it("collapses the whitespace a pretty-printed <title> carries", () => {
		const html = "<head><title>\n\t Spread   out \n</title></head>";
		expect(parseMetadata(html).title).toBe("Spread out");
	});

	it("returns nulls for a document with no metadata at all", () => {
		expect(parseMetadata("<html><body>hi</body></html>")).toEqual({
			title: null,
			description: null,
			image: null,
		});
	});

	it("treats an empty content attribute as absent", () => {
		const html = `<head><meta property="og:title" content="   "><title>Fallback</title></head>`;
		expect(parseMetadata(html).title).toBe("Fallback");
	});

	it("ignores a <title> that appears after </head>", () => {
		const html = `<head><meta name="description" content="d"></head><body><title>Not this</title></body>`;
		expect(parseMetadata(html).title).toBeNull();
	});

	describe("article headline vs. page title", () => {
		it("drops the masthead declared by og:site_name", () => {
			const html = `<head><meta property="og:site_name" content="The Verge"><title>How the deal fell apart — The Verge</title></head>`;
			expect(parseMetadata(html).title).toBe("How the deal fell apart");
		});

		it("drops a masthead that only matches the host", () => {
			const html = "<head><title>How the deal fell apart | Reuters</title></head>";
			expect(parseMetadata(html, "https://www.reuters.com/").title).toBe("How the deal fell apart");
		});

		it("trims the brand off og:title as well", () => {
			const html = `<head><meta property="og:title" content="A quiet week in review | Stratechery"></head>`;
			expect(parseMetadata(html, "https://stratechery.com/").title).toBe("A quiet week in review");
		});

		it("keeps a dash that is part of the headline", () => {
			const html = "<head><title>Rust 2.0 — what changed and why</title></head>";
			expect(parseMetadata(html, "https://example.com/").title).toBe(
				"Rust 2.0 — what changed and why",
			);
		});

		it("finds the brand under a subdomain", () => {
			const html = "<head><title>Neuromancer - Wikipedia</title></head>";
			expect(parseMetadata(html, "https://en.wikipedia.org/").title).toBe("Neuromancer");
		});

		it("leaves a tail that is not the site alone", () => {
			const html = "<head><title>Y Combinator | Hacker News</title></head>";
			expect(parseMetadata(html, "https://news.ycombinator.com/").title).toBe(
				"Y Combinator | Hacker News",
			);
		});

		it("keeps the whole title when stripping would leave a stub", () => {
			const html = "<head><title>Home | Reuters</title></head>";
			expect(parseMetadata(html, "https://reuters.com/").title).toBe("Home | Reuters");
		});
	});

	describe("preview image", () => {
		it("prefers og:image:secure_url, then og:image, then twitter:image", () => {
			const html = `<head><meta name="twitter:image" content="https://a.test/t.png"><meta property="og:image" content="https://a.test/og.png"></head>`;
			expect(parseMetadata(html).image).toBe("https://a.test/og.png");
		});

		it("takes og:image:secure_url over og:image", () => {
			const html = `<head><meta property="og:image" content="https://a.test/og.png"><meta property="og:image:secure_url" content="https://cdn.a.test/og.png"></head>`;
			expect(parseMetadata(html).image).toBe("https://cdn.a.test/og.png");
		});

		it("resolves a relative og:image against the page", () => {
			const html = `<head><meta property="og:image" content="/img/cover.jpg?w=1&amp;h=2"></head>`;
			expect(parseMetadata(html, "https://blog.test/posts/1").image).toBe(
				"https://blog.test/img/cover.jpg?w=1&h=2",
			);
		});

		it("drops an http image, which an https page would block", () => {
			const html = `<head><meta property="og:image" content="http://a.test/og.png"></head>`;
			expect(parseMetadata(html).image).toBeNull();
		});

		it("drops a relative image when there is no page URL to resolve it against", () => {
			const html = `<head><meta property="og:image" content="/og.png"></head>`;
			expect(parseMetadata(html).image).toBeNull();
		});
	});
});

describe("parseFxTwitter", () => {
	const post = (tweet: Record<string, unknown>) => ({ code: 200, tweet });

	it("titles the post by its author and keeps the full text", () => {
		const meta = parseFxTwitter(
			post({
				text: "Breaking: Browser Use + Jev = Ultrafast\n\n> new action space every step",
				author: { name: "Gregor Zunic", screen_name: "gregpr07" },
			}),
		);
		expect(meta).toEqual({
			title: "Gregor Zunic (@gregpr07)",
			description: "Breaking: Browser Use + Jev = Ultrafast\n\n> new action space every step",
			image: null,
		});
	});

	it("falls back to the handle when the display name is only a symbol", () => {
		const meta = parseFxTwitter(post({ text: "hi", author: { name: "⃟", screen_name: "anishfn" } }));
		expect(meta?.title).toBe("@anishfn");
	});

	it("uses a photo's own URL", () => {
		const meta = parseFxTwitter(
			post({
				author: { name: "TablePlus", screen_name: "TablePlus" },
				media: { all: [{ type: "photo", url: "https://pbs.twimg.com/media/x.jpg?name=orig" }] },
			}),
		);
		expect(meta?.image).toBe("https://pbs.twimg.com/media/x.jpg?name=orig");
	});

	it("uses a video's thumbnail, never the mp4", () => {
		const meta = parseFxTwitter(
			post({
				author: { name: "A", screen_name: "a" },
				media: {
					all: [
						{
							type: "video",
							url: "https://video.twimg.com/v.mp4",
							thumbnail_url: "https://pbs.twimg.com/thumb.jpg",
						},
					],
				},
			}),
		);
		expect(meta?.image).toBe("https://pbs.twimg.com/thumb.jpg");
	});

	it("collapses runs of blank lines but keeps paragraph breaks", () => {
		const meta = parseFxTwitter(
			post({ text: "one  two\n\n\n\nthree", author: { name: "A", screen_name: "a" } }),
		);
		expect(meta?.description).toBe("one two\n\nthree");
	});

	it("falls back to the quoted post's media, then the link card", () => {
		const author = { name: "A", screen_name: "a" };
		const quoted = parseFxTwitter(
			post({
				author,
				quote: { media: { all: [{ type: "photo", url: "https://pbs.twimg.com/q.jpg" }] } },
				card: { image: { url: "https://pbs.twimg.com/card.jpg" } },
			}),
		);
		expect(quoted?.image).toBe("https://pbs.twimg.com/q.jpg");

		const carded = parseFxTwitter(
			post({ author, card: { image: { url: "https://pbs.twimg.com/card.jpg" } } }),
		);
		expect(carded?.image).toBe("https://pbs.twimg.com/card.jpg");
	});

	it("reads a long-form article's title, opening and cover when the post has no text", () => {
		const meta = parseFxTwitter(
			post({
				text: "",
				author: { name: "dex", screen_name: "dexhorthy" },
				article: {
					title: "/show-me: compact visuals",
					preview_text: "tl;dr make your agent converse visually.",
					cover_media: { media_info: { original_img_url: "https://pbs.twimg.com/cover.png" } },
				},
			}),
		);
		expect(meta).toEqual({
			title: "dex (@dexhorthy)",
			description: "/show-me: compact visuals\n\ntl;dr make your agent converse visually.",
			image: "https://pbs.twimg.com/cover.png",
		});
	});

	it("returns null for a body that is not a post", () => {
		expect(parseFxTwitter({ code: 404, message: "NOT_FOUND" })).toBeNull();
		expect(parseFxTwitter(null)).toBeNull();
	});
});

describe("xStatusEndpoint", () => {
	const endpoint = (url: string) => xStatusEndpoint(new URL(url));

	it("maps a status URL on any X host, dropping the tracking query", () => {
		expect(endpoint("https://x.com/TablePlus/status/2102636659049464298?s=20")).toBe(
			"https://api.fxtwitter.com/TablePlus/status/2102636659049464298",
		);
		expect(endpoint("https://mobile.twitter.com/a_b/status/1/photo/1")).toBe(
			"https://api.fxtwitter.com/a_b/status/1",
		);
		expect(endpoint("https://x.com/i/web/status/42")).toBe("https://api.fxtwitter.com/i/status/42");
	});

	it("ignores profiles, other hosts, and lookalike paths", () => {
		expect(endpoint("https://x.com/TablePlus")).toBeNull();
		expect(endpoint("https://example.com/a/status/1")).toBeNull();
		expect(endpoint("https://x.com/a/status/1abc")).toBeNull();
	});
});

describe("tidyXHead", () => {
	it("drops the ' on X' tail and the t.co links", () => {
		expect(
			tidyXHead({
				title: "TablePlus (@TablePlus) on X",
				description: "https://t.co/5lmRp4raS3 now only 4 MB https://t.co/glz2pcQktc",
				image: null,
			}),
		).toEqual({ title: "TablePlus (@TablePlus)", description: "now only 4 MB", image: null });
	});

	it("leaves no description rather than an empty one", () => {
		expect(
			tidyXHead({ title: "A (@a) on X", description: "https://t.co/Ec2FhgsLgG", image: null })
				.description,
		).toBeNull();
	});
});
