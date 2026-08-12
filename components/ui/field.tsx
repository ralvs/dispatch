"use client";

import { ChevronDown } from "lucide-react";
import {
	createContext,
	forwardRef,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
	useContext,
	useId,
} from "react";
import { type FieldControlVariants, fieldControl } from "./field-variants";
import { Icon } from "./icon";
import { tv } from "./tv";

/**
 * The `fieldControl` recipe lives in ./field-variants — imported here, never
 * re-exported, so server callers never receive a client reference. See the
 * note there.
 */

const selectShell = tv({
	extend: fieldControl,
	base: "appearance-none pr-7",
});

const textareaShell = tv({
	base: [
		"field-shell w-full text-ink outline-none",
		"placeholder:text-ink-4",
		"disabled:cursor-not-allowed disabled:opacity-50",
		"h-auto resize-none px-0 py-1.5 text-sm",
	],
	variants: {
		size: {
			sm: "min-h-20",
			md: "min-h-28",
			lg: "min-h-36",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

type FieldCtx = {
	id: string;
	describedBy?: string;
	invalid?: boolean;
};

const FieldContext = createContext<FieldCtx | null>(null);

function useFieldCtx() {
	return useContext(FieldContext);
}

type FieldShellProps = {
	label?: string;
	description?: string;
	error?: string;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
};

/** Label + description/error wiring. Owns the 12px caption + a11y ids. */
export function Field({
	label,
	description,
	error,
	htmlFor,
	children,
	className,
}: FieldShellProps) {
	const autoId = useId();
	const controlId = htmlFor ?? autoId;
	const descId = description ? `${controlId}-desc` : undefined;
	const errId = error ? `${controlId}-err` : undefined;
	const describedBy = [errId, descId].filter(Boolean).join(" ") || undefined;

	return (
		<div className={["field-unit", className].filter(Boolean).join(" ")}>
			{label && (
				<label htmlFor={controlId} className="field-caption mb-2 block text-xs">
					{label}
				</label>
			)}
			<FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error) }}>
				{children}
			</FieldContext.Provider>
			{error && (
				<p id={errId} role="alert" className="mt-2 text-meta text-error">
					{error}
				</p>
			)}
			{description && !error && (
				<p id={descId} className="mt-2 text-meta text-ink-4">
					{description}
				</p>
			)}
		</div>
	);
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
	FieldControlVariants & {
		invalid?: boolean;
	};

export function Input({
	size = "md",
	invalid,
	className,
	type = "text",
	value,
	defaultValue,
	id,
	...props
}: InputProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;
	const isNativeDate = type === "date" || type === "time" || type === "datetime-local";
	const resolved = value !== undefined ? value : defaultValue;
	const dataEmpty = isNativeDate ? (String(resolved ?? "") === "" ? "true" : "false") : undefined;

	return (
		<input
			id={id ?? ctx?.id}
			type={type}
			value={value}
			defaultValue={defaultValue}
			data-invalid={isInvalid || undefined}
			data-empty={dataEmpty}
			aria-invalid={isInvalid || undefined}
			aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
			className={fieldControl({
				size,
				className: [isNativeDate ? "tf-native" : "", className].filter(Boolean).join(" "),
			})}
			{...props}
		/>
	);
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> &
	FieldControlVariants & {
		invalid?: boolean;
	};

export function Select({ size = "md", invalid, className, children, id, ...props }: SelectProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;

	return (
		<div className="relative">
			<select
				id={id ?? ctx?.id}
				data-invalid={isInvalid || undefined}
				aria-invalid={isInvalid || undefined}
				aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
				className={selectShell({ size, className })}
				{...props}
			>
				{children}
			</select>
			<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-ink-3">
				<Icon icon={ChevronDown} size="sm" />
			</span>
		</div>
	);
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
	FieldControlVariants & {
		invalid?: boolean;
	};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ size = "md", invalid, className, id, ...props },
	ref,
) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;

	return (
		<textarea
			ref={ref}
			id={id ?? ctx?.id}
			data-invalid={isInvalid || undefined}
			aria-invalid={isInvalid || undefined}
			aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
			className={textareaShell({ size, className })}
			{...props}
		/>
	);
});
