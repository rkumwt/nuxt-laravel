import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "antd";
import InviteRegister from "@/components/auth/InviteRegister";

export const metadata: Metadata = { title: "Complete Registration" };

// `params` is only known at request time, so it is awaited inside <Suspense>
async function Invite({ params }: { params: PageProps<"/invite/[code]">["params"] }) {
  const { code } = await params;
  return <InviteRegister inviteCode={code} />;
}

export default function InvitePage(props: PageProps<"/invite/[code]">) {
  return (
    <Suspense fallback={<Skeleton active />}>
      <Invite params={props.params} />
    </Suspense>
  );
}
