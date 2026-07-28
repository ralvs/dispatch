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

import { type KeyboardEvent, useRef, useState } from "react";
import { activeMentionQuery, type MentionCandidate, normalizeName } from "@/lib/mentions";

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

	function recompute(el: FieldEl | null) {
		if (!el) return;
		const caret = el.selectionStart ?? value.length;
		const active = activeMentionQuery(value, caret);
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
		const caret = el.selectionStart ?? value.length;
		const before = value.slice(0, state.start);
		const after = value.slice(caret);
		const inserted = `${item.name} `;
		onValueChange(`${before}${inserted}${after}`);
		setState(CLOSED);
		const pos = before.length + inserted.length;
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(pos, pos);
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

function MentionDropdown({
	items,
	selected,
	onPick,
}: {
	items: MentionCandidate[];
	selected: number;
	onPick: (item: MentionCandidate) => void;
}) {
	return (
		<ul
			aria-label="Matching people"
			className="absolute left-0 top-full z-20 mt-1 min-w-40 max-w-64 rounded-md border border-line bg-surface py-1 shadow-lg"
		>
			{items.map((item, index) => (
				<li key={item.id}>
					<button
						type="button"
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
				</li>
			))}
		</ul>
	);
}

type MentionFieldProps = {
	value: string;
	onValueChange: (value: string) => void;
	people: MentionCandidate[];
};

export function MentionTextInput({
	value,
	onValueChange,
	people,
	className,
	onKeyDown: userOnKeyDown,
	onSelect: userOnSelect,
	onBlur: userOnBlur,
	...rest
}: MentionFieldProps &
	Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof MentionFieldProps | "onChange">) {
	const ref = useRef<HTMLInputElement>(null);
	const { state, recompute, accept, onKeyDown, close } = useMentionAutocomplete(
		value,
		people,
		onValueChange,
	);

	return (
		<div className="relative">
			<input
				{...rest}
				ref={ref}
				value={value}
				className={className}
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
	onKeyDown: userOnKeyDown,
	onSelect: userOnSelect,
	onBlur: userOnBlur,
	...rest
}: MentionFieldProps &
	Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, keyof MentionFieldProps | "onChange">) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const { state, recompute, accept, onKeyDown, close } = useMentionAutocomplete(
		value,
		people,
		onValueChange,
	);

	return (
		<div className="relative">
			<textarea
				{...rest}
				ref={ref}
				value={value}
				className={className}
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
					items={state.items}
					selected={state.selected}
					onPick={(item) => accept(ref.current, item)}
				/>
			)}
		</div>
	);
}
