/**
 * Closes the task dialog when you navigate anywhere else. A soft navigation
 * keeps a slot's last page if nothing in the slot matches the new URL, so the
 * dialog would stay open over the next page; matching every URL here with
 * nothing is what clears it (Next.js docs, Parallel Routes → Modals).
 */
export default function ModalCatchAll() {
	return null;
}
