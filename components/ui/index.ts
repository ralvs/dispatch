/*
 * The rule the `button` line below encodes, stated once so the next recipe
 * does not have to rediscover it: a `tv()` recipe is a pure string function
 * and servers call it; every export of a `"use client"` module is a client
 * reference and throws when called during a server render. So a recipe used
 * from a server component lives in its own `<name>-variants.ts`, and only the
 * component stays in the `.tsx`.
 *
 * `button` was moved after both not-found pages hit exactly that throw.
 * `checkbox`, `radio`, and `fieldControl` are still exported from `"use
 * client"` modules below and would throw the same way the first time a server
 * component reaches for them — `fieldControl` is the likeliest, since it is
 * already consumed as a bare class constant. Left as-is deliberately: no
 * server caller today, and the move is a refactor, not a cleanup.
 */
export { Badge, badge, MENTION_CHIP_CLASS, NOTE_CHIP_CLASS } from "./badge";
export { Button } from "./button";
export { type ButtonVariants, button } from "./button-variants";
export { Card, card } from "./card";
export { Checkbox, checkbox } from "./checkbox";
export { Dialog, DialogBody, DialogFooter } from "./dialog";
export { EmptyState } from "./empty-state";
export { Field, fieldControl, Input, Select, Textarea } from "./field";
export { ICON_SIZES, Icon, type IconSize } from "./icon";
export { ListRow, rowTitle } from "./list-row";
export { type Measure, PageHeader } from "./page-header";
export { PageSkeleton } from "./page-skeleton";
export { Progress } from "./progress";
export { Radio, radio } from "./radio";
export { SectionHead } from "./section-head";
export {
	suggestionEmpty,
	suggestionEmptyText,
	suggestionOption,
	suggestionPanel,
} from "./suggestion-surface";
