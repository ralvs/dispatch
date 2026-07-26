// Frozen sample of one day, shared by every design on /compare so the five
// directions are judged on form alone. Mirrors the shape of BriefingView
// (lib/services/briefing.ts) but is plain data — no server imports, no auth.

export type CompareDay = typeof DAY;

export const DAY = {
	dateIso: "2026-07-20",
	dateline: "Mon 20 Jul 2026",
	weekday: "Monday",
	isoWeek: 30,
	timezone: "America/Sao_Paulo",
	nowLabel: "09:41",
	unreadNotifications: 3,

	anchor: {
		eventCount: 4,
		nextEvent: { time: "10:30", title: "Sync with Marina — Q3 roadmap" },
		openCount: 11,
		overdueCount: 2,
	},

	// The scannable counts row.
	cadence: [
		{ key: "tasks", big: "11", label: "open tasks", href: "/tasks", slip: false },
		{ key: "overdue", big: "2", label: "overdue", href: "/tasks", slip: true },
		{ key: "events", big: "4", label: "events", href: "/today", slip: false },
		{ key: "routines", big: "3/6", label: "routines done", href: "/routines", slip: false },
		{ key: "streak", big: "12", label: "day streak", href: "/routines", slip: false },
	],

	// Things waiting on a decision.
	alerts: [
		{ key: "inbox", count: 5, label: "in the inbox", href: "/inbox" },
		{ key: "review", count: 2, label: "need review", href: "/notes" },
		{ key: "links", count: 7, label: "unread links", href: "/links" },
	],

	schedule: {
		allDay: [
			{
				key: "ad-1",
				kind: "event" as const,
				title: "Ana's birthday",
				meta: "Family",
				top3: false,
				done: false,
			},
			{
				key: "ad-2",
				kind: "task" as const,
				title: "Send the Casa Verde deposit",
				meta: "Money · due today",
				top3: true,
				done: false,
			},
		],
		timeline: [
			{
				key: "t-1",
				kind: "task" as const,
				time: "09:00",
				title: "Review the migration plan",
				meta: "Work",
				top3: true,
				done: true,
			},
			{
				key: "t-2",
				kind: "event" as const,
				time: "10:30",
				title: "Sync with Marina — Q3 roadmap",
				meta: "45 min · Meet",
				top3: false,
				done: false,
			},
			{
				key: "t-3",
				kind: "event" as const,
				time: "13:00",
				title: "Lunch with Pedro",
				meta: "Vila Madalena",
				top3: false,
				done: false,
			},
			{
				key: "t-4",
				kind: "task" as const,
				time: "16:00",
				title: "Draft the capture ADR",
				meta: "Dispatch · Top 3",
				top3: true,
				done: false,
			},
			{
				key: "t-5",
				kind: "event" as const,
				time: "19:30",
				title: "Jiu-jitsu",
				meta: "Health",
				top3: false,
				done: false,
			},
		],
		open: [
			{
				key: "o-1",
				title: "Reply to the landlord about the inspection",
				meta: "Home · overdue 3d",
				overdue: true,
				top3: false,
				done: false,
			},
			{
				key: "o-2",
				title: "Book the dentist",
				meta: "Health · overdue 1d",
				overdue: true,
				top3: false,
				done: false,
			},
			{
				key: "o-3",
				title: "Pick a photographer for the trip",
				meta: "Travel",
				overdue: false,
				top3: false,
				done: false,
			},
		],
	},

	// One row per domain at or past its cadence.
	brief: [
		{
			key: "family",
			name: "Family",
			daysSince: 9,
			thresholdDays: 7,
			slipping: true,
			unit: "days since contact",
			nextAction: "Call your mother — last spoke on the 11th.",
			href: "/domains/family",
		},
		{
			key: "money",
			name: "Money",
			daysSince: 14,
			thresholdDays: 14,
			slipping: true,
			unit: "days since review",
			nextAction: "Reconcile June — two card bills still unmatched.",
			href: "/domains/money",
		},
		{
			key: "health",
			name: "Health",
			daysSince: 3,
			thresholdDays: 7,
			slipping: false,
			unit: "days since training",
			nextAction: "Jiu-jitsu tonight at 19:30 keeps the streak.",
			href: "/domains/health",
		},
	],

	routines: {
		done: 3,
		total: 6,
		buckets: [
			{
				bucket: "Morning",
				rows: [
					{ id: "r1", name: "Water + stretch", done: true, streak: 21, time: "07:00" },
					{ id: "r2", name: "Read 20 pages", done: true, streak: 12, time: null },
					{ id: "r3", name: "Journal one line", done: true, streak: 34, time: null },
				],
			},
			{
				bucket: "Afternoon",
				rows: [{ id: "r4", name: "Walk after lunch", done: false, streak: 5, time: "14:00" }],
			},
			{
				bucket: "Evening",
				rows: [
					{ id: "r5", name: "Inbox to zero", done: false, streak: 8, time: null },
					{ id: "r6", name: "Lights out by 23:00", done: false, streak: 2, time: "23:00" },
				],
			},
		],
	},

	projects: [
		{ id: "p1", name: "Dispatch v1", progress: 0.72, nextMilestone: "Ship the capture palette" },
		{ id: "p2", name: "Casa Verde", progress: 0.4, nextMilestone: "Sign the contract" },
		{ id: "p3", name: "Portugal trip", progress: 0.15, nextMilestone: "Lock the dates" },
	],

	resurfaced: {
		text: "A gente não faz amigos, reconhece-os.",
		author: "Vinícius de Moraes",
		reference: "Para viver um grande amor",
		skips: 1,
	},

	latestQuote: {
		text: "The work is the reward. Everything after is weather.",
		author: "Anne Lamott",
		reference: "Bird by Bird",
	},

	capture: ["Journal", "Quote", "Note", "Task"],
};
