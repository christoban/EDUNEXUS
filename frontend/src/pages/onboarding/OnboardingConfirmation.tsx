import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function OnboardingConfirmation() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
        <h1 className="mb-2 text-2xl font-bold">Demande envoyée !</h1>
        <p className="mb-6 text-lg text-emerald-50/90">
          Votre demande d'inscription a bien été prise en compte.<br />
          Vous recevrez un email dès que le super administrateur aura validé votre établissement.
        </p>
        <Link
          to="/"
          className="inline-block rounded-lg bg-emerald-400 px-6 py-3 font-semibold text-black hover:bg-emerald-300"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
