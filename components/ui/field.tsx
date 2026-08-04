"use client";

import { ChevronDown } from "lucide-react";
import {
	createContext,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
	useContext,
	useId,
} from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Icon } from "./icon";

/**
 * Field shape comes from --field-* tokens (data-ui variant swap).
 * `display` is always a bare serif line — headings you type into, not form chrome.
 */
export const fieldControl = tv({
	base: [
		"w-full text-ink outline-none transition-colors",
		"placeholder:text-ink-4",
		"disabled:cursor-not-allowed disabled:opacity-50",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
	],
	variants: {
		variant: {
			data: "field-shell px-2.5 text-sm hover:border-line-strong focus:border-line-strong data-[invalid]:border-error",
			display:
				"border-0 border-b border-line bg-transparent px-0 font-serif text-ink placeholder:font-normal placeholder:text-ink-4 focus:border-line-strong data-[invalid]:border-error rounded-none",
		},
		size: {
			sm: "h-7",
			md: "h-9",
			lg: "h-11",
		},
		displaySize: {
			lg: "h-auto py-1 text-lg",
			xl: "h-auto py-1 text-2xl",
		},
	},
	defaultVariants: {
		variant: "data",
		size: "md",
		displaySize: "lg",
	},
});

export type FieldControlVariants = VariantProps<typeof fieldControl>;

const selectShell = tv({
	extend: fieldControl,
	base: "appearance-none pr-8",
});

const textareaShell = tv({
	base: [
		"w-full text-ink outline-none transition-colors",
		"placeholder:text-ink-4",
		"disabled:cursor-not-allowed disabled:opacity-50",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
		"h-auto resize-none py-2",
	],
	variants: {
		variant: {
			data: "field-shell px-2.5 text-sm hover:border-line-strong focus:border-line-strong data-[invalid]:border-error",
			display:
				"border-0 border-b border-line bg-transparent px-0 font-serif text-ink placeholder:font-normal placeholder:text-ink-4 focus:border-line-strong data-[invalid]:border-error rounded-none",
		},
		size: {
			sm: "min-h-20",
			md: "min-h-24",
			lg: "min-h-32",
		},
	},
	defaultVariants: {
		variant: "data",
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

/** Label + description/error wiring. Owns mono eyebrow label + a11y ids. */
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
		<div className={className}>
			{label && (
				<label
					htmlFor={controlId}
					className="mb-1.5 block font-mono text-eyebrow uppercase tracking-widest text-ink-3"
				>
					{label}
				</label>
			)}
			<FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error) }}>
				{children}
			</FieldContext.Provider>
			{error && (
				<p id={errId} role="alert" className="mt-1.5 text-meta text-error">
					{error}
				</p>
			)}
			{description && !error && (
				<p id={descId} className="mt-1.5 text-meta text-ink-4">
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
	variant = "data",
	size = "md",
	displaySize,
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
				variant,
				size: variant === "display" ? undefined : size,
				displaySize: variant === "display" ? (displaySize ?? "lg") : undefined,
				className: [isNativeDate ? "tf-native" : "", className].filter(Boolean).join(" "),
			})}
			{...props}
		/>
	);
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> &
	Pick<FieldControlVariants, "variant" | "size"> & {
		invalid?: boolean;
	};

export function Select({
	variant = "data",
	size = "md",
	invalid,
	className,
	children,
	id,
	...props
}: SelectProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;

	return (
		<div className="relative">
			<select
				id={id ?? ctx?.id}
				data-invalid={isInvalid || undefined}
				aria-invalid={isInvalid || undefined}
				aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
				className={selectShell({ variant, size, className })}
				{...props}
			>
				{children}
			</select>
			<span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-ink-3">
				<Icon icon={ChevronDown} size="sm" />
			</span>
		</div>
	);
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
	Pick<FieldControlVariants, "variant" | "size"> & {
		invalid?: boolean;
	};

export function Textarea({
	variant = "data",
	size = "md",
	invalid,
	className,
	id,
	...props
}: TextareaProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;

	return (
		<textarea
			id={id ?? ctx?.id}
			data-invalid={isInvalid || undefined}
			aria-invalid={isInvalid || undefined}
			aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
			className={textareaShell({ variant, size, className })}
			{...props}
		/>
	);
}
