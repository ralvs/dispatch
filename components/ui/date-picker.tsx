"use client";

import { parseDate } from "@internationalized/date";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
	Button as AriaButton,
	DatePicker as AriaDatePicker,
	Calendar,
	CalendarCell,
	CalendarGrid,
	CalendarGridBody,
	CalendarGridHeader,
	CalendarHeaderCell,
	DateInput,
	DateSegment,
	type DateValue,
	Group,
	Heading,
	Popover,
} from "react-aria-components";
import { Icon } from "./icon";
import { suggestionPanel } from "./suggestion-surface";

const FIELD_GROUP =
	"field-shell flex h-9 w-full min-w-0 items-center text-base text-ink disabled:cursor-not-allowed disabled:opacity-50";

const SEGMENT =
	"rounded-sm px-0.5 outline-none data-[placeholder]:text-ink-4 data-[type=literal]:text-ink-4 data-[focused]:bg-accent-bg data-[focused]:text-accent-ink";

const DAY =
	"flex size-9 items-center justify-center rounded-control font-mono text-meta tabular-nums outline-none data-[outside-month]:invisible data-[disabled]:opacity-30 data-[today]:text-accent-ink data-[selected]:bg-accent-bg data-[selected]:text-accent-ink data-[focused]:outline data-[focused]:outline-2 data-[focused]:outline-offset-[-2px] data-[focused]:outline-accent";

function toDateValue(iso: string): DateValue | null {
	if (!iso) return null;
	return parseDate(iso);
}

/**
 * Calendar date only. Value is a `YYYY-MM-DD` string — CalendarDate stays in
 * this file so lib/dates.ts remains the timezone boundary (iron rule #1).
 */
export function DatePicker({
	name,
	value,
	onChange,
	todayIso,
	"aria-label": ariaLabel,
}: {
	name: string;
	value: string;
	onChange: (next: string) => void;
	/** App-timezone today — seeds the empty field's format, not the value. */
	todayIso: string;
	"aria-label": string;
}) {
	return (
		<AriaDatePicker
			aria-label={ariaLabel}
			value={toDateValue(value)}
			placeholderValue={parseDate(todayIso)}
			onChange={(next) => onChange(next ? next.toString() : "")}
			shouldForceLeadingZeros
			firstDayOfWeek="mon"
			className="min-w-0 w-full"
		>
			<input type="hidden" name={name} value={value} />
			<Group className={FIELD_GROUP}>
				<DateInput className="flex min-w-0 flex-1 items-center">
					{(segment) => <DateSegment segment={segment} className={SEGMENT} />}
				</DateInput>
				<AriaButton
					className="inline-flex size-9 shrink-0 items-center justify-center text-ink-3 outline-none hover:text-ink data-[focus-visible]:text-ink"
					aria-label="Open calendar"
				>
					<Icon icon={CalendarIcon} size="sm" />
				</AriaButton>
			</Group>
			<Popover className={`z-[60] p-3 ${suggestionPanel}`} placement="bottom start">
				<Calendar className="w-fit">
					<header className="mb-2 flex items-center justify-between gap-2">
						<AriaButton
							slot="previous"
							className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 outline-none hover:bg-surface-2 hover:text-ink data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent"
							aria-label="Previous month"
						>
							<Icon icon={ChevronLeft} size="sm" />
						</AriaButton>
						<Heading className="font-mono text-eyebrow uppercase tracking-widest text-ink-2" />
						<AriaButton
							slot="next"
							className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 outline-none hover:bg-surface-2 hover:text-ink data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent"
							aria-label="Next month"
						>
							<Icon icon={ChevronRight} size="sm" />
						</AriaButton>
					</header>
					<CalendarGrid weekdayStyle="short">
						<CalendarGridHeader>
							{(day) => (
								<CalendarHeaderCell className="h-7 text-center font-mono text-eyebrow uppercase text-ink-4">
									{day}
								</CalendarHeaderCell>
							)}
						</CalendarGridHeader>
						<CalendarGridBody>
							{(date) => <CalendarCell date={date} className={DAY} />}
						</CalendarGridBody>
					</CalendarGrid>
				</Calendar>
			</Popover>
		</AriaDatePicker>
	);
}
