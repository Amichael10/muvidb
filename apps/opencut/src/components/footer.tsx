import Link from "next/link";
import Image from "next/image";
import { DEFAULT_LOGO_URL } from "@/site/brand";

export function Footer() {
	return (
		<footer className="bg-background border-t">
			<div className="mx-auto flex max-w-5xl flex-col gap-4 px-8 py-8 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-2">
					<Image
						src={DEFAULT_LOGO_URL}
						alt="MuviDB"
						width={24}
						height={24}
						className="invert dark:invert-0"
					/>
					<span className="text-lg font-bold">MuviDB Studio</span>
				</div>
				<p className="text-muted-foreground text-sm">
					Internal use only · © {new Date().getFullYear()} MuviDB
				</p>
				<div className="flex gap-4 text-sm">
					<Link
						href="/projects"
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						Projects
					</Link>
					<Link
						href="/privacy"
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						Privacy
					</Link>
				</div>
			</div>
		</footer>
	);
}
