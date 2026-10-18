import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { applyTheme, getStoredTheme, type Theme } from "#/lib/theme";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
	{ value: "light", label: "Claro", icon: Sun },
	{ value: "dark", label: "Oscuro", icon: Moon },
	{ value: "system", label: "Sistema", icon: Monitor },
];

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("system");

	// localStorage solo existe en el navegador, por eso se lee en un efecto
	useEffect(() => {
		setTheme(getStoredTheme());
	}, []);

	// Si el tema es "system", seguimos los cambios del sistema operativo en vivo
	useEffect(() => {
		if (theme !== "system") return;
		const media = matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	function select(value: Theme) {
		setTheme(value);
		applyTheme(value);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Cambiar tema">
					<Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{options.map(({ value, label, icon: Icon }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => select(value)}
						data-active={theme === value}
						className="data-[active=true]:text-primary"
					>
						<Icon />
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
