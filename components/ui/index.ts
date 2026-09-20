/*
 * The rule the `button` line below encodes, stated once so the next recipe
 * does not have to rediscover it: a `tv()` recipe is a pure string function
 * and servers call it; every export of a `"use client"` module is a client
 * reference and throws when called during a server render. So a recipe used
 * from a server component lives in its own `<name>-variants.ts`, and only the
 * component stays in the `.tsx`.
 *
 * `button` was moved after both not-found pages hit exactly that throw.
 * `fieldControl` followed, because its one caller invokes it at module scope
 * — that runs at import time, so the throw would not even wait for a render.
 *
 * `checkbox` and `radio` are still exported from `"use client"` modules below
 * and would throw the same way. Left there deliberately: neither has a caller
 * outside its own module today, so moving them now would be speculative. If
 * you give either one a server caller, move it first.
 */
export { Badge, badge, MENTION_CHIP_CLASS, NOTE_CHIP_CLASS } from "./badge";
export { Button } from "./button";
export { type ButtonVariants, button } from "./button-variants";
export { Card, card } from "./card";
export { Checkbox, checkbox } from "./checkbox";
export { Dialog, DialogBody, DialogFooter } from "./dialog";
export { EmptyState } from "./empty-state";
export { Field, Input, Select, Textarea } from "./field";
export { type FieldControlVariants, fieldControl } from "./field-variants";
export { HeaderCreateButton } from "./header-create-button";
export { ICON_SIZES, Icon, type IconSize } from "./icon";
export { ListRow, rowTitle } from "./list-row";
export { ListSection } from "./list-section";
export { type Measure, PageHeader } from "./page-header";
export { PageSkeleton } from "./page-skeleton";
export { Progress } from "./progress";
export { Radio, radio } from "./radio";
export { type ScopeOption, ScopeSelect, UNFILED } from "./scope-select";
export { SectionHead } from "./section-head";
export { type Stat, StatBand } from "./stat-band";
export {
	suggestionEmpty,
	suggestionEmptyText,
	suggestionOption,
	suggestionPanel,
} from "./suggestion-surface";

// DatePicker and TimePicker are deliberately NOT re-exported here. They are
// react-aria-components + @internationalized/date, ~435 KB, and this barrel has
// 79 import sites including loading.tsx files — one of them re-exporting the
// pickers is how that weight reached every route. Import them from
// "./date-picker" / "./time-picker" directly, and lazily where you can
// (app/(authed)/tasks/task-fields.tsx does).
