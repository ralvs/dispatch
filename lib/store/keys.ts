import type { ViewKey } from "@/lib/store/types";

/** Typed view-key builders. The key string is the identity of a cached view. */
export const viewKey = {
	tasks: () => "tasks" as ViewKey<"taskLists">,
	day: (dateIso: string) => `day:${dateIso}` as ViewKey<"day">,
	project: (id: string) => `project:${id}` as ViewKey<"taskList">,
	inbox: () => "inbox" as ViewKey<"taskList">,
};
