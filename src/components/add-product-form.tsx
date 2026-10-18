import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { addProduct } from "#/server/products";

type Feedback =
	| { kind: "error"; message: string }
	| { kind: "exists"; id: number }
	| null;

export function AddProductForm() {
	const router = useRouter();
	const navigate = useNavigate();
	const [url, setUrl] = useState("");
	const [pending, setPending] = useState(false);
	const [feedback, setFeedback] = useState<Feedback>(null);

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setPending(true);
		setFeedback(null);
		try {
			// Se llama como función normal, pero viaja al servidor por HTTP
			const result = await addProduct({ data: { url } });

			if (result.status === "invalid") {
				setFeedback({ kind: "error", message: result.error });
			} else if (result.status === "exists") {
				setFeedback({ kind: "exists", id: result.id });
			} else {
				setUrl("");
				// Marca los loaders como desactualizados para que la lista se recargue
				await router.invalidate();
				await navigate({
					to: "/products/$productId",
					params: { productId: String(result.id) },
				});
			}
		} catch {
			setFeedback({
				kind: "error",
				message: "Algo salió mal, intenta de nuevo",
			});
		} finally {
			setPending(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-2">
			<div className="flex gap-2">
				<Input
					type="text"
					inputMode="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="Pega un link de Amazon o Mercado Libre…"
					aria-label="Link del producto"
					aria-invalid={feedback?.kind === "error"}
					disabled={pending}
				/>
				<Button type="submit" disabled={pending || url.trim() === ""}>
					{pending ? <Loader2 className="animate-spin" /> : <Plus />}
					Agregar
				</Button>
			</div>
			{feedback?.kind === "error" && (
				<p className="text-sm text-destructive">{feedback.message}</p>
			)}
			{feedback?.kind === "exists" && (
				<p className="text-sm text-info">
					Ya sigues este producto.{" "}
					<Link
						to="/products/$productId"
						params={{ productId: String(feedback.id) }}
						className="underline underline-offset-4"
					>
						Ver producto
					</Link>
				</p>
			)}
		</form>
	);
}
