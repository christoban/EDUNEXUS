import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
	schoolName: z.string().min(3, "Nom de l'établissement requis"),
	templateKey: z.string().min(1, "Choisis un template"),
	location: z.string().optional(),
	contactEmail: z.string().email("Email invalide").optional(),
	contactPhone: z.string().optional(),
	requestedAdminName: z.string().min(3, "Nom administrateur requis"),
	requestedAdminEmail: z.string().email("Email administrateur invalide"),
	plan: z.string().optional(),
});

const SchoolOnboardingForm = () => {
	const [values, setValues] = useState({
		schoolName: "",
		templateKey: "fr_secondary",
		location: "",
		contactEmail: "",
		contactPhone: "",
		requestedAdminName: "",
		requestedAdminEmail: "",
		plan: "standard",
	});
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		const parsed = formSchema.safeParse(values);
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message || "Formulaire invalide");
			return;
		}

		try {
			setLoading(true);
			const { data } = await api.post("/onboarding/requests", parsed.data);
			toast.success("Demande créée — un email d'activation sera envoyé à l'admin.");
			// Optionally navigate or refresh list; for now just clear form
			setValues({
				schoolName: "",
				templateKey: "fr_secondary",
				location: "",
				contactEmail: "",
				contactPhone: "",
				requestedAdminName: "",
				requestedAdminEmail: "",
				plan: "standard",
			});
		} catch (err: any) {
			toast.error(err?.response?.data?.message || "Impossible de créer la demande");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<div className="space-y-3">
				<h2 className="text-lg font-bold">Créer une demande d'onboarding</h2>
				<p className="text-sm text-slate-400">Remplis les informations de l'établissement et l'email de l'administrateur.</p>
			</div>

			<div className="mt-4 grid gap-3">
				<Input placeholder="Nom de l'établissement" value={values.schoolName} onChange={(e) => setValues((v) => ({ ...v, schoolName: e.target.value }))} />
				<select className="rounded-md border border-white/10 bg-white/5 p-3" value={values.templateKey} onChange={(e) => setValues((v) => ({ ...v, templateKey: e.target.value }))}>
					<option value="fr_secondary">Lycée / Secondaire (FR)</option>
					<option value="fr_primary">Primaire (FR)</option>
					<option value="en_primary">Primary (EN)</option>
					<option value="bilingual_complex">Bilingue (complex)</option>
					<option value="technical_school">Technique</option>
				</select>
				<Input placeholder="Localisation (ville)" value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} />
				<Input placeholder="Email de contact" value={values.contactEmail} onChange={(e) => setValues((v) => ({ ...v, contactEmail: e.target.value }))} />
				<Input placeholder="Téléphone" value={values.contactPhone} onChange={(e) => setValues((v) => ({ ...v, contactPhone: e.target.value }))} />
				<Input placeholder="Nom complet de l'admin" value={values.requestedAdminName} onChange={(e) => setValues((v) => ({ ...v, requestedAdminName: e.target.value }))} />
				<Input placeholder="Email admin" value={values.requestedAdminEmail} onChange={(e) => setValues((v) => ({ ...v, requestedAdminEmail: e.target.value }))} />
				<select
					className="rounded-md border border-white/10 bg-white/5 p-3 text-white"
					value={values.plan}
					onChange={(e) => setValues((v) => ({ ...v, plan: e.target.value }))}
				>
					<option value="standard">Standard</option>
					<option value="premium">Premium</option>
					<option value="discovery">Découverte (gratuit)</option>
				</select>
				<div className="flex gap-3">
					<Button variant="outline" onClick={() => setValues({
						schoolName: "",
						templateKey: "fr_secondary",
						location: "",
						contactEmail: "",
						contactPhone: "",
						requestedAdminName: "",
						requestedAdminEmail: "",
						plan: "standard",
					})}>Réinitialiser</Button>
					<Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={handleSubmit} disabled={loading}>{loading ? "Envoi..." : "Créer la demande"}</Button>
				</div>
			</div>
		</div>
	);
};

export default SchoolOnboardingForm;