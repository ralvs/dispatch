"use client";

import { Clock } from "lucide-react";
import {
	Button as AriaButton,
	Input as AriaInput,
	ComboBox,
	Group,
	ListBox,
	ListBoxItem,
	Popover,
} from "react-aria-components";
import { wallClockSlots } from "@/lib/time-slots";
import { Icon } from "./icon";
import { suggestionOption, suggestionPanel } from "./suggestion-surface";

const SLOTS = wallClockSlots(15);

const FIELD_GROUP =
	"field-shell flex h-9 w-full min-w-0 items-center text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Time as a pick-from-list ComboBox, not RAC TimeField — TimeField is type-only
 * and has no clock. Slots are 15-minute HH:mm labels; the value stays a string
 * so form submit and lib/dates never see a RAC Time object.
 */
export function TimePicker({
	name,
	value,
	onChange,
	disabled = false,
	"aria-label": ariaLabel,
}: {
	name: string;
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
	"aria-label": string;
}) {
	return (
		<ComboBox
			aria-label={ariaLabel}
			isDisabled={disabled}
			menuTrigger="focus"
			value={value || null}
			onChange={(key) => onChange(key == null ? "" : String(key))}
			className="min-w-0 w-full"
		>
			<input type="hidden" name={name} value={value} disabled={disabled} />
			<Group className={FIELD_GROUP}>
				<AriaInput
					placeholder="--:--"
					className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-4"
				/>
				<AriaButton
					className="inline-flex size-9 shrink-0 items-center justify-center text-ink-3 outline-none hover:text-ink data-[disabled]:pointer-events-none data-[focus-visible]:text-ink"
					aria-label="Open time list"
				>
					<Icon icon={Clock} size="sm" />
				</AriaButton>
			</Group>
			<Popover
				className={`z-[60] max-h-64 w-[var(--trigger-width)] overflow-hidden ${suggestionPanel}`}
				placement="bottom start"
			>
				<ListBox className="max-h-64 overflow-y-auto py-1 outline-none">
					{SLOTS.map((slot) => (
						<ListBoxItem
							key={slot}
							id={slot}
							textValue={slot}
							className={({ isFocused, isSelected }) => suggestionOption(isSelected || isFocused)}
						>
							{slot}
						</ListBoxItem>
					))}
				</ListBox>
			</Popover>
		</ComboBox>
	);
}
