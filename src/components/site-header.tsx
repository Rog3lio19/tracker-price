import { Link } from "@tanstack/react-router";
import { TrendingDown } from "lucide-react";

import { ThemeToggle } from "#/components/theme-toggle";

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
			<div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
				<Link to="/" className="flex items-center gap-2 font-semibold">
					<TrendingDown className="size-5 text-success" />
					<span>Tracker Price</span>
				</Link>
				<nav className="flex items-center gap-4 text-sm text-muted-foreground">
					<Link
						to="/"
						activeOptions={{ exact: true }}
						className="hover:text-foreground"
						activeProps={{ className: "text-foreground font-medium" }}
					>
						Productos
					</Link>
					<Link
						to="/settings"
						search={{}}
						className="hover:text-foreground"
						activeProps={{ className: "text-foreground font-medium" }}
					>
						Configuración
					</Link>
				</nav>
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
