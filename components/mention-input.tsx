"use client";

// Task-side @mention autocomplete (docs/adr/0030 D2/D3): plain `@Name` text,
// resolved client-side against the same `activeMentionQuery`/`normalizeName`
// lib/mentions.ts uses to resolve on save, so the dropdown and the eventual
// server-side match never disagree about what counts as a name.
//
// Two exports, one shared hook — `MentionTextInput` and `MentionTextarea`
// wrap the plain `<input>`/`<textarea>` they replace and stay controlled
// (`value`/`onValueChange`) so accepting a suggestion can splice the full
// name into the field's value directly.

import { type KeyboardEvent, useId, useRef, useState } from "react";
import {
	activeMentionQuery,
	type MentionCandidate,
	normalizeName,
	spliceMention,
} from "@/lib/mentions";

const MAX_SUGGESTIONS = 8;

function filterCandidates(people: MentionCandidate[], query: string): MentionCandidate[] {
	const norm = normalizeName(query);
	return people.filter((p) => normalizeName(p.name).includes(norm)).slice(0, MAX_SUGGESTIONS);
}

type FieldEl = HTMLInputElement | HTMLTextAreaElement;

type MentionState = {
	open: boolean;
	start: number;
	items: MentionCandidate[];
	selected: number;
};

const CLOSED: MentionState = { open: false, start: 0, items: [], selected: 0 };

/** Shared caret-driven autocomplete state, used by both field wrappers below. */
function useMentionAutocomplete(
	value: string,
	people: MentionCandidate[],
	onValueChange: (value: string) => void,
) {
	const [state, setState] = useState<MentionState>(CLOSED);

	// Both helpers read `el.value`, never the `value` prop. `recompute` runs
	// synchronously inside onChange, one React tick BEFORE the prop catches up,
	// so the prop is always one keystroke stale there — it would compute the
	// suggestions for what was typed a moment ago (typing "@Th" offered the
	// candidates for "@T", and the keystroke before that offered all of them).
	// The DOM element is the only source that is current in every handler.
	function recompute(el: FieldEl | null) {
		if (!el) return;
		const current = el.value;
		const caret = el.selectionStart ?? current.length;
		const active = activeMentionQuery(current, caret);
		if (!active) {
			setState(CLOSED);
			return;
		}
		const items = filterCandidates(people, active.query);
		if (items.length === 0) {
			setState(CLOSED);
			return;
		}
		setState({ open: true, start: active.start, items, selected: 0 });
	}

	function accept(el: FieldEl | null, item: MentionCandidate) {
		if (!el) return;
		const current = el.value;
		const caret = el.selectionStart ?? current.length;
		const next = spliceMention(current, state.start, caret, item.name);
		onValueChange(next.value);
		setState(CLOSED);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(next.caret, next.caret);
		});
	}

	/** Returns true when the keystroke was consumed by the dropdown. */
	function onKeyDown(el: FieldEl | null, e: KeyboardEvent<FieldEl>): boolean {
		if (!state.open) return false;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setState((s) => ({ ...s, selected: (s.selected + 1) % s.items.length }));
			return true;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setState((s) => ({ ...s, selected: (s.selected - 1 + s.items.length) % s.items.length }));
			return true;
		}
		if (e.key === "Enter" || e.key === "Tab") {
			const item = state.items[state.selected];
			if (item) {
				e.preventDefault();
				e.stopPropagation();
				accept(el, item);
				return true;
			}
			return false;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			setState(CLOSED);
			return true;
		}
		return false;
	}

	return { state, recompute, accept, onKeyDown, close: () => setState(CLOSED) };
}

/** Builds the id of the option at `index` within the listbox `listId`. */
function optionId(listId: string, index: number): string {
	return `${listId}-option-${index}`;
}

function MentionDropdown({
	listId,
	items,
	selected,
	onPick,
}: {
	listId: string;
	items: MentionCandidate[];
	selected: number;
	onPick: (item: MentionCandidate) => void;
}) {
	return (
		<div
			id={listId}
			role="listbox"
			aria-label="Matching people"
			className="absolute left-0 top-full z-20 mt-1 min-w-40 max-w-64 rounded-control border border-line bg-surface py-1 elevation-overlay"
		>
			{items.map((item, index) => (
				<button
					key={item.id}
					type="button"
					id={optionId(listId, index)}
					role="option"
					aria-selected={index === selected}
					// Prevent the field from blurring before the click's mousedown
					// resolves — a blur first would close the dropdown and drop
					// the selection.
					onMouseDown={(e) => {
						e.preventDefault();
						onPick(item);
					}}
					className={`block w-full truncate px-3 py-1.5 text-left font-mono text-meta ${
						index === selected ? "bg-accent-bg text-accent-ink" : "text-ink-2"
					}`}
				>
					{item.name}
				</button>
			))}
		</div>
	);
}

type MentionFieldProps = {
	value: string;
	onValueChange: (value: string) => void;
	people: MentionCandidate[];
	/**
	 * The dropdown needs a positioned wrapper around the field, so a caller
	 * that flexes the field itself has to size that wrapper too — `flex-1` on
	 * the input alone never reaches the box the flex row is actually laying out.
	 */
	wrapperClassName?: string;
};

export function MentionTextInput({
	value,
	onValueChange,
	people,
	className,
	wrapperClassName,
	onKeyDown: userOnKeyDown,
	onSelect: userOnSelect,
	onBlur: userOnBlur,
	...rest
}: MentionFieldProps &
	Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof MentionFieldProps | "onChange">) {
	const ref = useRef<HTMLInputElement>(null);
	const listId = useId();
	const { state, recompute, accept, onKeyDown, close } = useMentionAutocomplete(
		value,
		people,
		onValueChange,
	);

	return (
		<div className={`relative ${wrapperClassName ?? ""}`}>
			<input
				{...rest}
				ref={ref}
				value={value}
				className={className}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={state.open}
				aria-controls={listId}
				aria-activedescendant={state.open ? optionId(listId, state.selected) : undefined}
				onChange={(e) => {
					onValueChange(e.target.value);
					recompute(e.target);
				}}
				onSelect={(e) => {
					recompute(e.currentTarget);
					userOnSelect?.(e);
				}}
				onKeyDown={(e) => {
					const consumed = onKeyDown(ref.current, e);
					if (!consumed) userOnKeyDown?.(e);
				}}
				onBlur={(e) => {
					close();
					userOnBlur?.(e);
				}}
			/>
			{state.open && (
				<MentionDropdown
					listId={listId}
					items={state.items}
					selected={state.selected}
					onPick={(item) => accept(ref.current, item)}
				/>
			)}
		</div>
	);
}

export function MentionTextarea({
	value,
	onValueChange,
	people,
	className,
	wrapperClassName,
	onKeyDown: userOnKeyDown,
	onSelect: userOnSelect,
	onBlur: userOnBlur,
	...rest
}: MentionFieldProps &
	Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, keyof MentionFieldProps | "onChange">) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const listId = useId();
	const { state, recompute, accept, onKeyDown, close } = useMentionAutocomplete(
		value,
		people,
		onValueChange,
	);

	return (
		<div className={`relative ${wrapperClassName ?? ""}`}>
			<textarea
				{...rest}
				ref={ref}
				value={value}
				className={className}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={state.open}
				aria-controls={listId}
				aria-activedescendant={state.open ? optionId(listId, state.selected) : undefined}
				onChange={(e) => {
					onValueChange(e.target.value);
					recompute(e.target);
				}}
				onSelect={(e) => {
					recompute(e.currentTarget);
					userOnSelect?.(e);
				}}
				onKeyDown={(e) => {
					const consumed = onKeyDown(ref.current, e);
					if (!consumed) userOnKeyDown?.(e);
				}}
				onBlur={(e) => {
					close();
					userOnBlur?.(e);
				}}
			/>
			{state.open && (
				<MentionDropdown
					listId={listId}
					items={state.items}
					selected={state.selected}
					onPick={(item) => accept(ref.current, item)}
				/>
			)}
		</div>
	);
}
