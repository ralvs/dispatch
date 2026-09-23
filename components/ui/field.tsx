"use client";

import { ChevronDown } from "lucide-react";
import {
	createContext,
	type InputHTMLAttributes,
	type ReactNode,
	type Ref,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
	useContext,
	useId,
} from "react";
import { type FieldControlVariants, fieldControl } from "./field-variants";
import { useFieldError, useFieldValue } from "./form-state";
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
	/**
	 * The form field this wraps. Inside a form shell, the last submit's error
	 * for this name shows here when `error` is not given (#23).
	 */
	name?: string;
	htmlFor?: string;
	children: ReactNode;
	className?: string;
};

/** Label + description/error wiring. Owns the 12px caption + a11y ids. */
export function Field({
	label,
	description,
	error: errorProp,
	name,
	htmlFor,
	children,
	className,
}: FieldShellProps) {
	const submitError = useFieldError(name);
	const error = errorProp ?? submitError;
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

/**
 * The last submit's error for a field that is not wrapped in `<Field>` — a
 * composite control such as the task form's date and time pair. Link the
 * control to it with `aria-describedby={errorId(id)}` where the control
 * accepts one.
 */
export function FieldError({ name, id }: { name: string; id?: string }) {
	const error = useFieldError(name);
	if (!error) return null;
	return (
		<p id={id} role="alert" className="mt-2 text-meta text-error">
			{error}
		</p>
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
	// A rejected submit hands back what was typed (#23). Uncontrolled only.
	const echoed = useFieldValue(props.name);
	const echoable = value === undefined && type !== "checkbox" && type !== "radio";
	const initial = echoable && echoed !== undefined ? echoed : defaultValue;
	const resolved = value !== undefined ? value : initial;
	const dataEmpty = isNativeDate ? (String(resolved ?? "") === "" ? "true" : "false") : undefined;

	return (
		<input
			id={id ?? ctx?.id}
			type={type}
			value={value}
			defaultValue={initial}
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

export function Select({
	size = "md",
	invalid,
	className,
	children,
	id,
	defaultValue,
	...props
}: SelectProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;
	const echoed = useFieldValue(props.name);

	return (
		<div className="relative">
			<select
				id={id ?? ctx?.id}
				defaultValue={props.value === undefined ? (echoed ?? defaultValue) : undefined}
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
		ref?: Ref<HTMLTextAreaElement>;
	};

// React 19 passes `ref` as a prop; no forwardRef.
export function Textarea({
	size = "md",
	invalid,
	className,
	id,
	defaultValue,
	ref,
	...props
}: TextareaProps) {
	const ctx = useFieldCtx();
	const isInvalid = invalid ?? ctx?.invalid;
	const echoed = useFieldValue(props.name);

	return (
		<textarea
			ref={ref}
			id={id ?? ctx?.id}
			defaultValue={props.value === undefined ? (echoed ?? defaultValue) : undefined}
			data-invalid={isInvalid || undefined}
			aria-invalid={isInvalid || undefined}
			aria-describedby={props["aria-describedby"] ?? ctx?.describedBy}
			className={textareaShell({ size, className })}
			{...props}
		/>
	);
}
