import { redirect } from "next/navigation";
import { Link } from "@/lib/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { FestivalForm } from "@/components/admin/festival-form";

async function getMyOrganizers(userId: string) {
  const supabase = await createClient();

  // Organizers only see their own organizer profiles
  const { data } = await supabase
    .from("organizers")
    .select("*")
    .eq("owner_id", userId)
    .order("name");

  return data ?? [];
}

export default async function NewFestivalPage() {
  const supabase = await createClient();
  const t = await getTranslations("organizerPortal");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const organizers = await getMyOrganizers(user.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/organizer/festivals"
            className="-ml-3 flex items-center gap-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all px-3 py-2 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold">{t("createFestival")}</h1>
        </div>
        <p className="text-muted-foreground">
          Set up a new festival hub with official events and updates
        </p>
      </div>

      {/* Festival Form */}
      <FestivalForm
        userId={user.id}
        organizers={organizers}
        redirectTo="/organizer/festivals"
      />
    </div>
  );
}
