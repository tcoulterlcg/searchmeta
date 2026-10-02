import { createClient } from "@/lib/supabase/server";
import { CopyField } from "@/components/CopyField";

/** Shows the user's personal forwarding address and the last few emails received. */
export async function HeritageForwarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("inbound_token").eq("id", user.id).maybeSingle(),
    supabase
      .from("inbound_emails")
      .select("id, subject, snippet, items_found, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const base = process.env.INBOUND_EMAIL_ADDRESS;
  const address = base && profile?.inbound_token ? base.replace("@", `+${profile.inbound_token}@`) : null;

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Heritage alerts</div>
      {!address ? (
        <p className="mt-2 text-sm text-muted">In Development</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Heritage doesn&apos;t allow automated searching, so Grailio works from Heritage&apos;s own alert emails.
          </p>
          <div className="mt-3">
            <CopyField value={address} />
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>On ha.com, save your searches to your <b className="text-text">Want List</b> with email alerts on.</li>
            <li>In your email, auto-forward emails from <b className="text-text">ha.com</b> to the address above.</li>
            <li>Gmail sends a confirmation code first. It will show up below.</li>
          </ol>

          {recent && recent.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Recently received</div>
              {recent.map((e) => (
                <div key={e.id} className="rounded-lg bg-ink p-3 text-sm">
                  <div className="font-medium">{e.subject || "(no subject)"}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {e.items_found > 0 ? `${e.items_found} Heritage lot${e.items_found === 1 ? "" : "s"} found` : "No Heritage lots in this email"}
                  </div>
                  {e.items_found === 0 && e.snippet && (
                    <div className="mt-1 line-clamp-4 text-xs text-muted">{e.snippet}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
