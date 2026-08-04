import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Single icon size ladder for the app. 14/16/20 matches the control height
 * scale (sm/md/lg). strokeWidth 1.5 keeps the weight of the retired hand glyphs.
 */
export const ICON_SIZES = {
	sm: 14,
	md: 16,
	lg: 20,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

type IconProps = {
	icon: LucideIcon;
	size?: IconSize;
} & Omit<LucideProps, "size" | "ref">;

export function Icon({ icon: Lucide, size = "md", strokeWidth = 1.5, ...props }: IconProps) {
	const px = ICON_SIZES[size];
	const decorative = props["aria-label"] == null && props["aria-labelledby"] == null;
	return (
		<Lucide
			size={px}
			strokeWidth={strokeWidth}
			aria-hidden={decorative ? true : undefined}
			{...props}
		/>
	);
}
