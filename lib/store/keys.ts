import type { ViewKey } from "@/lib/store/types";

/** Typed view-key builders. The key string is the identity of a cached view. */
export const viewKey = {
	tasks: () => "tasks" as ViewKey<"taskLists">,
	day: (dateIso: string) => `day:${dateIso}` as ViewKey<"day">,
	project: (id: string) => `project:${id}` as ViewKey<"taskList">,
	/** The /projects board: every task tagged with a project that was open at read, and any added since. */
	projectBoardTasks: () => "projectBoardTasks" as ViewKey<"taskList">,
	inbox: () => "inbox" as ViewKey<"taskList">,
	/** A task opened by its URL (docs/adr/0079): a list of one, with no scope, so nothing new joins it. */
	task: (id: string) => `task:${id}` as ViewKey<"taskList">,
	notifications: () => "notifications" as ViewKey<"notificationList">,
	notes: () => "notes" as ViewKey<"noteLists">,
	/** One list for Today's card and /routines: the same rows, the same order. */
	routines: () => "routines" as ViewKey<"routineList">,
	quotes: () => "quotes" as ViewKey<"quoteList">,
	journal: () => "journal" as ViewKey<"journalList">,
	links: () => "links" as ViewKey<"linkList">,
	people: () => "people" as ViewKey<"personList">,
	/** The person page's header: a list of one. */
	person: (id: string) => `person:${id}` as ViewKey<"personList">,
	personFacts: (id: string) => `personFacts:${id}` as ViewKey<"personFactList">,
	projects: () => "projects" as ViewKey<"projectList">,
	/** The project page's header: a list of one. */
	projectHead: (id: string) => `projectHead:${id}` as ViewKey<"projectList">,
	domains: () => "domains" as ViewKey<"domainList">,
	personInteractions: (id: string) =>
		`personInteractions:${id}` as ViewKey<"personInteractionList">,
};
