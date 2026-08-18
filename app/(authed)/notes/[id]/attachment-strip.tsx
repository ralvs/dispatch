"use client";

import { File as FileIcon, FileText, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	type ClipboardEvent as ReactClipboardEvent,
	type DragEvent as ReactDragEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { Button, ListRow, rowTitle, SectionHead } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { attachmentKind, formatBytes, isAllowedContentType } from "@/lib/attachments";
import { runAction, toastError } from "@/lib/client/toast";
import type { Attachment } from "@/lib/schemas/note";
import { removeAttachmentAction } from "../actions";

/*
 * Files on a note (docs/adr/0052).
 *
 * This component wraps the editor rather than sitting beside it, because the
 * drop target is the whole note — dropping a photo onto the middle of your
 * text is the gesture people actually make. The handlers are all capture-phase
 * so they fire before ProseMirror sees the event: that is what keeps
 * note-editor.tsx, and the autosave inside it, untouched.
 *
 * The body is never modified. Files live in `notes.attachments`, so the stored
 * markdown stays exactly what was typed (iron rule #5).
 */

const ACCEPT = "image/*,application/pdf,.md,.txt,.markdown";

/**
 * Only react to files. Dragging selected text inside the note is an ordinary
 * text drag and must keep working — module scope so the window listener below
 * has a stable reference.
 */
function carriesFiles(transfer: DataTransfer | null): boolean {
	return Boolean(transfer && Array.from(transfer.types).includes("Files"));
}

export function AttachmentStrip({
	noteId,
	attachments,
	children,
}: {
	noteId: string;
	attachments: Attachment[];
	/** The editor subtree. Wrapped so the whole note is droppable. */
	children: ReactNode;
}) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [pending, startTransition] = useTransition();

	// dragenter/dragleave fire once per child element the pointer crosses, so a
	// boolean flickers as you move over the editor. Counting depth doesn't.
	const dragDepth = useRef(0);
	const [dragging, setDragging] = useState(false);

	const upload = useCallback(
		async (files: File[]) => {
			if (files.length === 0) return;
			setUploading(true);
			try {
				const form = new FormData();
				for (const file of files) form.append("files", file);

				const res = await fetch(`/api/notes/${noteId}/attachments`, {
					method: "POST",
					body: form,
				});
				const body = await res.json().catch(() => null);

				if (!res.ok && !body?.rejected?.length) {
					toastError(body?.error ?? "Couldn't attach the file.");
					return;
				}
				// Partial success is a real outcome — name what failed, keep what
				// landed. Silently dropping one of five files is the bug here.
				if (body?.rejected?.length) {
					const names = body.rejected
						.map((r: { name: string; reason: string }) => `${r.name} (${r.reason})`)
						.join(", ");
					toastError(`Couldn't attach ${names}`);
				}
				if (body?.attached?.length) router.refresh();
			} catch {
				toastError("Couldn't attach the file.");
			} finally {
				setUploading(false);
			}
		},
		[noteId, router],
	);

	function onDragEnter(event: ReactDragEvent) {
		if (!carriesFiles(event.dataTransfer)) return;
		dragDepth.current += 1;
		setDragging(true);
	}

	function onDragOver(event: ReactDragEvent) {
		if (!carriesFiles(event.dataTransfer)) return;
		// Without preventDefault the drop event never fires at all.
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
	}

	function onDragLeave(event: ReactDragEvent) {
		if (!carriesFiles(event.dataTransfer)) return;
		dragDepth.current = Math.max(0, dragDepth.current - 1);
		if (dragDepth.current === 0) setDragging(false);
	}

	function onDrop(event: ReactDragEvent) {
		if (!carriesFiles(event.dataTransfer)) return;
		// Stop here: ProseMirror must not also try to handle this.
		event.preventDefault();
		event.stopPropagation();
		dragDepth.current = 0;
		setDragging(false);
		void upload(Array.from(event.dataTransfer.files));
	}

	/** A pasted screenshot is the same gesture by another route. */
	function onPaste(event: ReactClipboardEvent) {
		const files = Array.from(event.clipboardData?.files ?? []);
		if (files.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		void upload(files);
	}

	// A file dropped just outside the zone would otherwise make the browser
	// navigate to it, losing both the file and any unsaved edit.
	//
	// The reset matters as much as the preventDefault: a drag that ends
	// anywhere but on our zone — dropped on the margin, abandoned outside the
	// window, cancelled with Escape — never sends the matching dragleave, so
	// without this the depth counter stays positive and the overlay is stuck
	// over the note until a reload.
	useEffect(() => {
		const clear = () => {
			dragDepth.current = 0;
			setDragging(false);
		};
		const swallow = (event: globalThis.DragEvent) => {
			if (!carriesFiles(event.dataTransfer)) return;
			event.preventDefault();
		};
		const swallowAndClear = (event: globalThis.DragEvent) => {
			swallow(event);
			clear();
		};
		window.addEventListener("dragover", swallow);
		window.addEventListener("drop", swallowAndClear);
		window.addEventListener("dragend", clear);
		return () => {
			window.removeEventListener("dragover", swallow);
			window.removeEventListener("drop", swallowAndClear);
			window.removeEventListener("dragend", clear);
		};
	}, []);

	const busy = uploading || pending;

	return (
		<div
			className="relative"
			onDragEnterCapture={onDragEnter}
			onDragOverCapture={onDragOver}
			onDragLeaveCapture={onDragLeave}
			onDropCapture={onDrop}
			onPasteCapture={onPaste}
		>
			{children}

			{dragging && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[--radius-card] border-2 border-dashed border-accent bg-accent-bg/80"
				>
					<span className="font-mono text-eyebrow uppercase tracking-widest text-accent-ink">
						Drop to attach
					</span>
				</div>
			)}

			<section aria-label="Files" className="mt-7">
				<SectionHead
					title="Files"
					aside={attachments.length > 0 ? String(attachments.length) : undefined}
				/>

				{attachments.length > 0 && (
					<ul>
						{attachments.map((attachment) => (
							<AttachmentRow
								key={attachment.storage_path}
								attachment={attachment}
								disabled={busy}
								onRemove={() =>
									startTransition(async () => {
										await runAction(
											() => removeAttachmentAction(noteId, attachment.storage_path),
											"Couldn't remove the file.",
										);
									})
								}
							/>
						))}
					</ul>
				)}

				<div className="mt-2">
					{/* Drag is unreachable by keyboard and absent on iOS, so the
					    button is the real control, not a fallback. */}
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						disabled={busy}
						isPending={uploading}
						onClick={() => inputRef.current?.click()}
					>
						<Icon icon={Paperclip} size="sm" />
						{uploading ? "Attaching…" : "Add file"}
					</Button>
					<input
						ref={inputRef}
						type="file"
						multiple
						accept={ACCEPT}
						className="sr-only"
						aria-label="Add files to this note"
						onChange={(event) => {
							const files = Array.from(event.target.files ?? []);
							// Reset first, so picking the same file twice still fires.
							event.target.value = "";
							void upload(files);
						}}
					/>
				</div>
			</section>
		</div>
	);
}

function AttachmentRow({
	attachment,
	disabled,
	onRemove,
}: {
	attachment: Attachment;
	disabled: boolean;
	onRemove: () => void;
}) {
	const type = attachment.content_type ?? "";
	const kind = isAllowedContentType(type) ? attachmentKind(type) : "text";
	const size = attachment.size_bytes ? formatBytes(attachment.size_bytes) : "";

	const remove = (
		<Button
			type="button"
			variant="danger-soft"
			size="sm"
			isIconOnly
			aria-label={`Remove ${attachment.name}`}
			disabled={disabled}
			onClick={onRemove}
		>
			<Icon icon={X} size="sm" />
		</Button>
	);

	if (kind === "image") {
		return (
			<ListRow
				align="start"
				trailing={remove}
				leading={
					<a href={attachment.url} target="_blank" rel="noreferrer" className="shrink-0">
						{/* Plain <img>, not next/image. The source is an owner-guarded
						    route, so the optimizer would need remotePatterns config
						    and would fetch it server-side without the session cookie.
						    The bytes are already downscaled to 2400px webp at upload
						    (lib/images.ts), so there is nothing left to optimize. */}
						{/* biome-ignore lint/performance/noImgElement: see above */}
						<img
							src={attachment.url}
							alt={attachment.alt ?? attachment.name}
							loading="lazy"
							className="h-14 w-14 rounded-[--radius-mark] border border-line object-cover"
						/>
					</a>
				}
			>
				<a
					href={attachment.url}
					target="_blank"
					rel="noreferrer"
					className={rowTitle({ className: "hover:text-accent-ink" })}
				>
					{attachment.name}
				</a>
				{size && <p className="mt-0.5 font-mono text-meta text-ink-4">{size}</p>}
			</ListRow>
		);
	}

	return (
		<ListRow
			align="start"
			trailing={remove}
			leading={
				<Icon
					icon={kind === "pdf" ? FileText : FileIcon}
					size="sm"
					className="mt-0.5 shrink-0 text-ink-3"
				/>
			}
		>
			<a
				href={attachment.url}
				target="_blank"
				rel="noreferrer"
				className={rowTitle({ className: "hover:text-accent-ink" })}
			>
				{attachment.name}
			</a>
			{size && <p className="mt-0.5 font-mono text-meta text-ink-4">{size}</p>}
		</ListRow>
	);
}
